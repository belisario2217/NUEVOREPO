import { useEffect, useState } from "react";
import {
  Award, ClipboardCheck, FileSpreadsheet, FileText, GraduationCap, Printer,
  Save, Sheet, Trash2, UserRoundX, UsersRound
} from "lucide-react";
import { api, download, openDocument } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import { Button, Field, Select } from "../components/Ui";

type Option = { id: number; name: string };
type Plan = { id: number; code: string; name: string; is_active: number };
type PlanSubject = { subject_id: number; code: string; name: string; recommended_period: number };
type CurricularSubject = {
  id: number;
  semester_number: number;
  subject_type: "mandatory" | "elective";
  credits: number;
  status: "pending" | "in_progress" | "completed";
  final_score: number | null;
  notes: string | null;
  student_number: string;
  student_name: string;
  subject_code: string;
  subject_name: string;
  group_name: string | null;
  cycle_name: string | null;
};

const reports = [
  { type: "students", title: "Lista de alumnos", description: "Directorio por grupo con programa, turno y estatus.", icon: UsersRound },
  { type: "attendance", title: "Lista de asistencia", description: "Formato basico imprimible para control diario.", icon: ClipboardCheck },
  { type: "gradebook", title: "Concentrado de calificaciones", description: "Resultados por alumno, materia y periodo.", icon: Sheet },
  { type: "subjects", title: "Reporte por materia", description: "Promedio, evaluaciones e indice de reprobacion.", icon: FileText },
  { type: "teachers", title: "Reporte por docente", description: "Materias, grupos asignados y promedio general.", icon: GraduationCap },
  { type: "failed", title: "Alumnos reprobados", description: "Resultados bajo el minimo aprobatorio.", icon: UserRoundX },
  { type: "outstanding", title: "Alumnos destacados", description: "Promedios generales iguales o superiores a 9.", icon: Award }
];

export function ReportsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planSubjects, setPlanSubjects] = useState<PlanSubject[]>([]);
  const [curricularRows, setCurricularRows] = useState<CurricularSubject[]>([]);
  const [drafts, setDrafts] = useState<Record<number, { semester: string; status: CurricularSubject["status"]; finalScore: string; notes: string }>>({});
  const [groupId, setGroupId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [planId, setPlanId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [semester, setSemester] = useState("1");
  const [busy, setBusy] = useState(false);

  async function loadCurricularRows() {
    const query = new URLSearchParams();
    if (groupId) query.set("groupId", groupId);
    if (studentId) query.set("studentId", studentId);
    if (semester) query.set("semester", semester);
    const rows = await api<CurricularSubject[]>(`/reports/curricular-subjects?${query}`);
    setCurricularRows(rows);
    setDrafts(Object.fromEntries(rows.map((row) => [row.id, {
      semester: String(row.semester_number),
      status: row.status,
      finalScore: row.final_score == null ? "" : String(row.final_score),
      notes: row.notes ?? ""
    }])));
  }

  useEffect(() => {
    Promise.all(["groups", "periods", "cycles"].map(async (type) => {
      const result = await api<{ records: any[] }>(`/catalogs/${type}`);
      return [type, result.records.filter((item) => item.is_active).map((item) => ({ id: item.id, name: item.name }))] as const;
    })).then((entries) => setOptions(Object.fromEntries(entries)));
    api<{ records: any[] }>("/students?pageSize=100").then((result) =>
      setOptions((current) => ({ ...current, students: result.records.map((student) => ({ id: student.id, name: `${student.student_number} - ${student.full_name}` })) }))
    );
    api<Plan[]>("/plans").then((records) => setPlans(records.filter((plan) => plan.is_active))).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!planId) {
      setPlanSubjects([]);
      return;
    }
    api<{ subjects: PlanSubject[] }>(`/plans/${planId}`)
      .then((detail) => setPlanSubjects(detail.subjects))
      .catch(() => setPlanSubjects([]));
  }, [planId]);

  useEffect(() => {
    loadCurricularRows().catch(() => undefined);
  }, [groupId, studentId, semester]);

  function reportPath(type: string, format: string) {
    const query = new URLSearchParams({ format });
    if (groupId) query.set("groupId", groupId);
    return `/reports/data/${type}?${query}`;
  }

  function reportCard(mode: "student" | "group") {
    const query = new URLSearchParams();
    if (mode === "student" && studentId) query.set("studentId", studentId);
    if (mode === "group" && groupId) query.set("groupId", groupId);
    if (periodId) query.set("periodId", periodId);
    if (!query.has(mode === "student" ? "studentId" : "groupId")) {
      toast.error(`Selecciona un ${mode === "student" ? "alumno" : "grupo"}.`);
      return;
    }
    openDocument(`/reports/report-card.pdf?${query}`);
  }

  async function assignSemesterSubjects() {
    if (!groupId) return toast.error("Selecciona un grupo.");
    if (!planId) return toast.error("Selecciona el plan academico.");
    const subjectIds = planSubjects.filter((subject) => String(subject.recommended_period) === semester).map((subject) => subject.subject_id);
    if (!subjectIds.length) return toast.error("Ese semestre no tiene materias en el plan seleccionado.");
    setBusy(true);
    try {
      const result = await api<{ count: number }>("/reports/curricular-subjects/bulk", {
        method: "POST",
        body: { groupId, planId, cycleId: cycleId || undefined, semester, subjectIds }
      });
      toast.success(`Materias aplicadas al grupo. Registros actualizados: ${result.count}.`);
      await loadCurricularRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible aplicar las materias.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCurricularSubject(row: CurricularSubject) {
    const draft = drafts[row.id];
    if (!draft) return;
    try {
      await api(`/reports/curricular-subjects/${row.id}`, {
        method: "PATCH",
        body: {
          semester: draft.semester,
          status: draft.status,
          finalScore: draft.finalScore,
          notes: draft.notes
        }
      });
      toast.success("Materia del alumno actualizada.");
      await loadCurricularRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar la materia.");
    }
  }

  async function deleteCurricularSubject(row: CurricularSubject) {
    if (!confirm(`Quitar ${row.subject_name} de ${row.student_name}?`)) return;
    try {
      await api(`/reports/curricular-subjects/${row.id}`, { method: "DELETE" });
      toast.success("Materia retirada del alumno.");
      await loadCurricularRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible borrar la materia.");
    }
  }

  const semesterSubjects = planSubjects.filter((subject) => String(subject.recommended_period) === semester);

  return (
    <div className="page-stack">
      <section className="report-card-builder">
        <div className="report-builder-intro">
          <div className="report-builder-icon"><GraduationCap size={28} /></div>
          <div><span>Documento oficial</span><h2>Boletas de calificaciones</h2><p>Generacion individual o masiva con identidad institucional.</p></div>
        </div>
        <div className="report-builder-controls">
          <Field label="Alumno"><Select options={options.students ?? []} value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="Seleccionar alumno" /></Field>
          <Field label="Grupo"><Select options={options.groups ?? []} value={groupId} onChange={(event) => setGroupId(event.target.value)} placeholder="Seleccionar grupo" /></Field>
          <Field label="Periodo"><Select options={options.periods ?? []} value={periodId} onChange={(event) => setPeriodId(event.target.value)} placeholder="Todos los periodos" /></Field>
          <div className="builder-buttons"><Button variant="secondary" icon={<Printer size={17} />} onClick={() => reportCard("student")}>Boleta individual</Button><Button icon={<Sheet size={17} />} onClick={() => reportCard("group")}>Boletas por grupo</Button></div>
        </div>
      </section>

      <section className="curricular-admin">
        <div className="section-heading standalone">
          <div><span>Trayectoria por semestre</span><h2>Materias colocadas a alumnos</h2></div>
        </div>
        <div className="curricular-controls">
          <Field label="Grupo"><Select options={options.groups ?? []} value={groupId} onChange={(event) => setGroupId(event.target.value)} placeholder="Seleccionar grupo" /></Field>
          <Field label="Alumno"><Select options={options.students ?? []} value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="Todos" /></Field>
          <Field label="Plan"><Select options={plans.map((plan) => ({ id: plan.id, name: `${plan.code} - ${plan.name}` }))} value={planId} onChange={(event) => setPlanId(event.target.value)} placeholder="Seleccionar plan" /></Field>
          <Field label="Semestre"><input type="number" min="1" value={semester} onChange={(event) => setSemester(event.target.value || "1")} /></Field>
          <Field label="Ciclo"><Select options={options.cycles ?? []} value={cycleId} onChange={(event) => setCycleId(event.target.value)} placeholder="Ciclo del grupo" /></Field>
          {can("reports.generate") && <Button icon={<GraduationCap size={17} />} busy={busy} onClick={assignSemesterSubjects}>Aplicar al grupo</Button>}
        </div>
        <div className="semester-subject-strip">
          {semesterSubjects.length
            ? semesterSubjects.map((subject) => <span key={subject.subject_id}>{subject.code} - {subject.name}</span>)
            : <small>Selecciona un plan para ver las materias configuradas en este semestre.</small>}
        </div>
        <div className="table-wrap curricular-table">
          <table>
            <thead><tr><th>Alumno</th><th>Materia</th><th>Semestre</th><th>Estado</th><th>Promedio</th><th>Notas</th><th>Acciones</th></tr></thead>
            <tbody>
              {curricularRows.map((row) => {
                const draft = drafts[row.id] ?? { semester: String(row.semester_number), status: row.status, finalScore: row.final_score == null ? "" : String(row.final_score), notes: row.notes ?? "" };
                return (
                  <tr key={row.id}>
                    <td><strong className="table-main">{row.student_name}</strong><span className="table-sub">{row.student_number} - {row.group_name ?? "Sin grupo"}</span></td>
                    <td><strong className="table-main">{row.subject_name}</strong><span className="table-sub">{row.subject_code} - {row.cycle_name ?? "Sin ciclo"}</span></td>
                    <td><input className="compact-input" type="number" min="1" value={draft.semester} onChange={(event) => setDrafts({ ...drafts, [row.id]: { ...draft, semester: event.target.value } })} /></td>
                    <td><select value={draft.status} onChange={(event) => setDrafts({ ...drafts, [row.id]: { ...draft, status: event.target.value as CurricularSubject["status"] } })}><option value="pending">Pendiente</option><option value="in_progress">Cursando</option><option value="completed">CURSADA</option></select></td>
                    <td><input className="compact-input" type="number" min="0" max="10" step="0.1" value={draft.finalScore} onChange={(event) => setDrafts({ ...drafts, [row.id]: { ...draft, finalScore: event.target.value } })} /></td>
                    <td><input value={draft.notes} onChange={(event) => setDrafts({ ...drafts, [row.id]: { ...draft, notes: event.target.value } })} /></td>
                    <td><div className="inline-actions"><button title="Guardar" onClick={() => saveCurricularSubject(row)}><Save size={16} /></button><button title="Borrar" onClick={() => deleteCurricularSubject(row)}><Trash2 size={16} /></button></div></td>
                  </tr>
                );
              })}
              {!curricularRows.length && <tr><td colSpan={7}><div className="empty-row">No hay materias colocadas con esos filtros.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="section-heading standalone"><div><span>Formatos operativos</span><h2>Reportes disponibles</h2></div><Field label="Filtrar por grupo"><Select options={options.groups ?? []} value={groupId} onChange={(event) => setGroupId(event.target.value)} placeholder="Todos los grupos" /></Field></div>
        <div className="report-grid">
          {reports.map((report) => (
            <article className="report-item" key={report.type}>
              <div className="report-item-icon"><report.icon size={23} /></div>
              <div><h3>{report.title}</h3><p>{report.description}</p></div>
              <div className="report-actions">
                <button title="Abrir PDF" onClick={() => openDocument(reportPath(report.type, "pdf"))}><FileText size={17} /><span>PDF</span></button>
                <button title="Descargar Excel" onClick={() => download(reportPath(report.type, "xlsx"), `${report.type}.xlsx`)}><FileSpreadsheet size={17} /><span>Excel</span></button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
