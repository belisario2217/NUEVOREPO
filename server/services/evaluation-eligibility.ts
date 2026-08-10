import { get } from "../db.js";

export type EvaluationEligibility = {
  eligible: boolean;
  attendanceRecorded: boolean;
  attendancePercentage: number;
  attendedClasses: number;
  scheduledClasses: number;
  registrationPaid: boolean;
  reasons: string[];
};

export function evaluationEligibility(assignmentId: number, enrollmentId: number): EvaluationEligibility {
  const attendance = get<{ scheduled: number; attended: number }>(
    `SELECT COALESCE(SUM(am.scheduled_classes), 0) AS scheduled,
     COALESCE(SUM(MIN(ar.attended_classes, am.scheduled_classes)), 0) AS attended
     FROM attendance_months am
     LEFT JOIN attendance_records ar ON ar.attendance_month_id = am.id AND ar.enrollment_id = ?
     WHERE am.assignment_id = ? AND am.status = 'confirmed'`,
    enrollmentId,
    assignmentId
  ) ?? { scheduled: 0, attended: 0 };
  const scheduledClasses = Number(attendance.scheduled ?? 0);
  const attendedClasses = Number(attendance.attended ?? 0);
  const attendancePercentage = scheduledClasses > 0
    ? Number((attendedClasses / scheduledClasses * 100).toFixed(1))
    : 0;

  const registration = get<{ paid: number }>(
    `SELECT CASE WHEN EXISTS (
       SELECT 1 FROM student_payments sp
       JOIN subject_assignments a ON a.id = ?
       JOIN academic_periods ap ON ap.id = a.period_id
       WHERE sp.enrollment_id = ?
       AND (sp.concept_type IN ('enrollment', 'reenrollment') OR LOWER(sp.concept) LIKE '%inscrip%')
       AND date(sp.paid_at) <= date(ap.end_date)
       AND date(sp.paid_at) >= date(ap.start_date, '-5 months')
     ) THEN 1 ELSE 0 END AS paid`,
    assignmentId,
    enrollmentId
  );
  const registrationPaid = Boolean(registration?.paid);
  const attendanceRecorded = scheduledClasses > 0;
  const reasons: string[] = [];
  if (!attendanceRecorded) reasons.push("No hay asistencia mensual confirmada.");
  else if (attendancePercentage < 80) reasons.push(`Asistencia insuficiente: ${attendancePercentage}% (mínimo 80%).`);
  if (!registrationPaid) reasons.push("No se encontró el pago de inscripción o reinscripción del periodo.");

  return {
    eligible: attendanceRecorded && attendancePercentage >= 80 && registrationPaid,
    attendanceRecorded,
    attendancePercentage,
    attendedClasses,
    scheduledClasses,
    registrationPaid,
    reasons
  };
}
