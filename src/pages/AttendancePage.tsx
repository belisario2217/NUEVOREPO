import { useEffect, useState } from "react";
import { CalendarCheck, CheckCheck, Save, Users } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { Button, EmptyState, Field, StatusBadge } from "../components/Ui";

type Assignment = {
  id: number;
  subject_code: string;
  subject_name: string;
  group_name: string;
  study_modality: string | null;
  teacher_name: string;
  period_name: string;
  cycle_name: string;
};

type AttendanceStudent = {
  enrollment_id: number;
  student_number: string;
  student_name: string;
  attended_classes: number;
  notes: string | null;
  eligibility: {
    attendancePercentage: number;
    registrationPaid: boolean;
    eligible: boolean;
    reasons: string[];
  };
};

type AttendanceData = {
  assignment: Assignment;
  month: string;
  attendanceMonth: { scheduled_classes: number; status: "draft" | "confirmed"; confirmed_at: string | null };
  students: AttendanceStudent[];
};

const currentMonth = new Date().toISOString().slice(0, 7);

export function AttendancePage() {
  const toast = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<AttendanceData | null>(null);
  const [scheduledClasses, setScheduledClasses] = useState(0);
  const [records, setRecords] = useState<Record<number, { attendedClasses: number; notes: string }>>({});
  const [busy, setBusy] = useState(false);

  async function loadAssignments() {
    const rows = await api<Assignment[]>("/attendance/assignments");
    setAssignments(rows);
    if (!selected && rows[0]) await loadAttendance(rows[0], month);
  }

  async function loadAttendance(assignment: Assignment, targetMonth = month) {
    setSelected(assignment);
    const result = await api<AttendanceData>(`/attendance/assignment/${assignment.id}?month=${targetMonth}`);
    setData(result);
    setScheduledClasses(Number(result.attendanceMonth.scheduled_classes || 0));
    setRecords(Object.fromEntries(result.students.map((student) => [student.enrollment_id, {
      attendedClasses: Number(student.attended_classes || 0),
      notes: student.notes ?? ""
    }])));
  }

  useEffect(() => { loadAssignments().catch((error) => toast.error(error instanceof Error ? error.message : "No fue posible cargar las materias.")); }, []);

  async function changeMonth(value: string) {
    const target = value || currentMonth;
    setMonth(target);
    if (selected) await loadAttendance(selected, target);
  }

  function markAllPresent() {
    if (scheduledClasses < 1) {
      toast.error("Primero captura el total de clases impartidas en el mes.");
      return;
    }
    setRecords(Object.fromEntries((data?.students ?? []).map((student) => [student.enrollment_id, {
      attendedClasses: scheduledClasses,
      notes: records[student.enrollment_id]?.notes ?? ""
    }])));
  }

  async function save(confirm: boolean) {
    if (!selected || !data) return;
    setBusy(true);
    try {
      const result = await api<{ message: string }>(`/attendance/assignment/${selected.id}`, {
        method: "PUT",
        body: {
          month,
          scheduledClasses,
          confirm,
          records: data.students.map((student) => ({
            enrollmentId: student.enrollment_id,
            attendedClasses: records[student.enrollment_id]?.attendedClasses ?? 0,
            notes: records[student.enrollment_id]?.notes ?? ""
          }))
        }
      });
      toast.success(result.message);
      await loadAttendance(selected, month);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar la asistencia.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="attendance-page page-stack">
      <section className="toolbar">
        <div className="toolbar-primary"><CalendarCheck size={21} /><div><strong>Asistencia mensual</strong><span className="table-sub">Captura y confirma la asistencia del grupo por materia.</span></div></div>
        <div className="toolbar-actions"><Field label="Mes"><input type="month" value={month} onChange={(event) => changeMonth(event.target.value).catch((error) => toast.error(error.message))} /></Field></div>
      </section>

      <section className="attendance-layout">
        <aside className="assignment-pane">
          <div className="assignment-toolbar"><div><span>Mis materias</span><strong>{assignments.length} asignaciones</strong></div></div>
          <div className="assignment-list">
            {assignments.map((assignment) => <button key={assignment.id} className={selected?.id === assignment.id ? "active" : ""} onClick={() => loadAttendance(assignment).catch((error) => toast.error(error.message))}>
              <span className="subject-mark">{assignment.subject_code}</span><div><strong>{assignment.subject_name}</strong><span>{assignment.group_name}</span><small>{assignment.period_name} · {assignment.teacher_name}</small></div>
            </button>)}
          </div>
        </aside>

        <main className="attendance-main">
          {data && selected ? <>
            <header className="attendance-heading">
              <div><span>{selected.cycle_name} · {selected.period_name}</span><h2>{selected.subject_name} — {selected.group_name}</h2><p>Modalidad: {selected.study_modality || "Sin especificar"}</p></div>
              <StatusBadge active={data.attendanceMonth.status === "confirmed"} label={data.attendanceMonth.status === "confirmed" ? "CONFIRMADA" : "BORRADOR"} />
            </header>
            <div className="attendance-controls">
              <Field label="Clases impartidas en el mes" required><input type="number" min={1} max={31} value={scheduledClasses || ""} onChange={(event) => setScheduledClasses(Number(event.target.value))} /></Field>
              <Button variant="secondary" icon={<CheckCheck size={17} />} onClick={markAllPresent}>Todos presentes</Button>
              <Button variant="secondary" icon={<Save size={17} />} busy={busy} onClick={() => save(false)}>Guardar borrador</Button>
              <Button icon={<CalendarCheck size={17} />} busy={busy} onClick={() => save(true)}>Confirmar mes</Button>
            </div>
            <div className="table-wrap"><table><thead><tr><th>Matrícula</th><th>Alumno</th><th>Asistencias</th><th>Porcentaje mensual</th><th>Inscripción / reinscripción</th><th>Observaciones</th></tr></thead><tbody>
              {data.students.map((student) => {
                const attended = records[student.enrollment_id]?.attendedClasses ?? 0;
                const percentage = scheduledClasses > 0 ? Math.min(100, attended / scheduledClasses * 100) : 0;
                return <tr key={student.enrollment_id}>
                  <td><strong>{student.student_number}</strong></td><td><strong className="table-main">{student.student_name}</strong></td>
                  <td><input className="compact-input" type="number" min={0} max={scheduledClasses || 31} value={attended} onChange={(event) => setRecords({ ...records, [student.enrollment_id]: { ...records[student.enrollment_id], attendedClasses: Number(event.target.value) } })} /></td>
                  <td><strong className={percentage >= 80 ? "grade-pass-text" : "grade-fail-text"}>{percentage.toFixed(1)}%</strong></td>
                  <td><StatusBadge active={student.eligibility.registrationPaid} label={student.eligibility.registrationPaid ? "PAGADA" : "PENDIENTE"} /></td>
                  <td><input value={records[student.enrollment_id]?.notes ?? ""} onChange={(event) => setRecords({ ...records, [student.enrollment_id]: { ...records[student.enrollment_id], notes: event.target.value } })} placeholder="Opcional" /></td>
                </tr>;
              })}
            </tbody></table></div>
          </> : <EmptyState icon={<Users size={28} />} title="Sin materias asignadas" text="Solo se muestran los grupos y materias vinculados al docente que inició sesión." />}
        </main>
      </section>
    </div>
  );
}
