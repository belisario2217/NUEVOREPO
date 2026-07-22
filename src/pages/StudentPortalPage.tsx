import { useEffect, useState } from "react";
import { Award, Banknote, BookOpenCheck, CircleGauge, Clock3, GraduationCap, ReceiptText, WalletCards } from "lucide-react";
import { api } from "../lib/api";
import { EmptyState, StatusBadge } from "../components/Ui";

type PortalData = {
  student: {
    student_name: string;
    student_number: string;
    level_name: string;
    program_name: string;
    group_name: string;
    shift_name: string;
    cycle_name: string;
    plan_name: string;
    plan_code: string;
  };
  progress: {
    totalCredits: number;
    earnedCredits: number;
    pendingCredits: number;
    percentage: number;
    average: number | null;
    completedSubjects: number;
    totalSubjects: number;
  };
  billing: {
    summary: {
      tuitionAmount: number;
      expectedPayments: number;
      expectedAmount: number;
      paidAmount: number;
      balance: number;
      paidInstallments: number;
      pendingInstallments: number;
    };
    payments: Array<{
      id: number;
      folio: string;
      amount: number;
      paid_at: string;
      payment_method: string | null;
      concept: string;
    }>;
  };
  subjects: Array<{
    plan_subject_id: number | null;
    subject_id: number;
    code: string;
    name: string;
    subject_type: "mandatory" | "elective";
    credits: number;
    recommended_period: number;
    course_cycle_name: string | null;
    teacher_name: string | null;
    partial_1: number | null;
    partial_2: number | null;
    partial_3: number | null;
    final_score: number | null;
    status: "pending" | "passed" | "failed" | null;
  }>;
};

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

export function StudentPortalPage() {
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<PortalData>("/portal")
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "No fue posible cargar tu informacion."));
  }, []);

  if (error) return <EmptyState icon={<GraduationCap size={27} />} title="Tu expediente no esta disponible" text={error} />;
  if (!data) return <div className="loading-panel">Cargando avance curricular...</div>;

  const { student, progress, subjects, billing } = data;

  return (
    <div className="student-portal page-stack">
      <section className="student-welcome">
        <div>
          <span>{student.level_name} - {student.cycle_name}</span>
          <h2>{student.student_name}</h2>
          <p>{student.student_number} - {student.program_name} - Grupo {student.group_name}</p>
        </div>
        <div>
          <span>Plan academico</span>
          <strong>{student.plan_name}</strong>
          <small>{student.plan_code}</small>
        </div>
      </section>

      <section className="portal-metrics">
        <div><CircleGauge size={22} /><span>Avance curricular</span><strong>{progress.percentage}%</strong></div>
        <div><Award size={22} /><span>Creditos obtenidos</span><strong>{progress.earnedCredits}<small> / {progress.totalCredits}</small></strong></div>
        <div><BookOpenCheck size={22} /><span>Materias aprobadas</span><strong>{progress.completedSubjects}<small> / {progress.totalSubjects}</small></strong></div>
        <div><GraduationCap size={22} /><span>Promedio general</span><strong>{progress.average?.toFixed(1) ?? "-"}</strong></div>
      </section>

      <section className="curricular-progress">
        <header>
          <div><span>Trayectoria academica</span><h3>Avance por creditos</h3></div>
          <strong>{progress.pendingCredits} creditos pendientes</strong>
        </header>
        <div className="curricular-track"><i style={{ width: Math.min(100, progress.percentage) + "%" }} /></div>
        <footer><span>0%</span><span>{progress.percentage}% completado</span><span>100%</span></footer>
      </section>

      <section className="payment-metrics">
        <div><ReceiptText size={21} /><span>Colegiaturas</span><strong>{billing.summary.paidInstallments}<small> / {billing.summary.expectedPayments}</small></strong></div>
        <div><Banknote size={21} /><span>Pagado</span><strong>{money(billing.summary.paidAmount)}</strong></div>
        <div><WalletCards size={21} /><span>Adeudo</span><strong>{money(billing.summary.balance)}</strong></div>
        <div><Clock3 size={21} /><span>Pendientes</span><strong>{billing.summary.pendingInstallments}</strong></div>
      </section>

      <section className="table-section">
        <header className="section-heading">
          <div><span>Estado de cuenta</span><h2>Pagos realizados</h2></div>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Folio</th><th>Fecha</th><th>Concepto</th><th>Metodo</th><th>Monto</th></tr>
            </thead>
            <tbody>
              {billing.payments.map((payment) => (
                <tr key={payment.id}>
                  <td><strong className="table-main">{payment.folio}</strong></td>
                  <td>{payment.paid_at}</td>
                  <td>{payment.concept}</td>
                  <td>{payment.payment_method ?? <span className="muted-cell">Sin metodo</span>}</td>
                  <td><strong>{money(payment.amount)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!billing.payments.length && <EmptyState icon={<ReceiptText size={25} />} title="Sin pagos registrados" text="Aun no hay pagos capturados en tu expediente." />}
      </section>

      <section className="portal-subjects">
        <header className="section-heading">
          <div><span>Mi carga academica</span><h2>Materias y calificaciones</h2></div>
          <div className="legend"><i className="legend-active" /> CURSADA <i className="legend-inactive" /> Pendiente</div>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Periodo</th><th>Materia</th><th>Tipo / creditos</th><th>Docente</th><th>Parcial 1</th><th>Parcial 2</th><th>Parcial 3</th><th>Promedio</th><th>Resultado</th></tr>
            </thead>
            <tbody>
              {subjects.map((subject) => (
                <tr key={subject.plan_subject_id ?? subject.subject_id}>
                  <td><strong>{subject.recommended_period}</strong>{subject.course_cycle_name && <span className="table-sub">{subject.course_cycle_name}</span>}</td>
                  <td><strong className="table-main">{subject.name}</strong><span className="table-sub">{subject.code}</span></td>
                  <td><span className={"subject-type " + subject.subject_type}>{subject.subject_type === "mandatory" ? "Obligatoria" : "Optativa"}</span><span className="table-sub">{subject.credits} creditos</span></td>
                  <td>{subject.teacher_name ?? <span className="muted-cell">Por asignar</span>}</td>
                  {[subject.partial_1, subject.partial_2, subject.partial_3].map((score, index) => (
                    <td key={index}><span className={score == null ? "partial-empty" : "partial-score"}>{score == null ? "-" : Number(score).toFixed(1)}</span></td>
                  ))}
                  <td><strong className={subject.final_score == null ? "" : subject.status === "passed" ? "grade-pass-text" : subject.status === "failed" ? "grade-fail-text" : ""}>{subject.final_score == null ? "-" : Number(subject.final_score).toFixed(1)}</strong></td>
                  <td>{subject.status === "passed" ? <StatusBadge active label="CURSADA" /> : subject.status === "failed" ? <StatusBadge label="Reprobada" /> : <StatusBadge label={subject.final_score == null ? "Por cursar" : "En curso"} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!subjects.length && <EmptyState icon={<Clock3 size={25} />} title="No hay materias en tu plan" text="Control escolar debe asignar un plan academico a tu inscripcion." />}
      </section>
    </div>
  );
}
```
