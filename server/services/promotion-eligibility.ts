import { get } from "../db.js";
import { buildBilling, type BillingSource } from "./billing.js";

export type PromotionEligibility = {
  eligible: boolean;
  currentPeriodNumber: number;
  targetPeriodNumber: number;
  targetPeriodName: string | null;
  overdueMonths: number;
  overdueAmount: number;
  recentTwoPaymentsCovered: boolean;
  registrationPaidForTarget: boolean;
  reasons: string[];
};

export function promotionEligibility(enrollmentId: number): PromotionEligibility {
  const enrollment = get<any>(
    `SELECT e.id, e.student_id AS studentId, e.plan_id AS planId, e.enrolled_at AS enrolledAt,
     e.tuition_start_date AS billingStartDate, e.tuition_due_day AS tuitionDueDay,
     p.duration_periods AS durationPeriods, pl.tuition_amount AS tuitionAmount,
     COALESCE(cp.sequence, 0) AS current_period_number, e.financial_clearance_override
     FROM enrollments e JOIN programs p ON p.id = e.program_id
     LEFT JOIN academic_plans pl ON pl.id = e.plan_id
     LEFT JOIN curricular_periods cp ON cp.id = e.curricular_period_id
     WHERE e.id = ? AND e.is_active = 1`,
    enrollmentId
  );
  if (!enrollment) {
    return { eligible: false, currentPeriodNumber: 0, targetPeriodNumber: 0, targetPeriodName: null, overdueMonths: 0, overdueAmount: 0, recentTwoPaymentsCovered: false, registrationPaidForTarget: false, reasons: ["No existe una inscripción activa."] };
  }
  const currentPeriodNumber = Number(enrollment.current_period_number ?? 0);
  const targetPeriodNumber = currentPeriodNumber + 1;
  const targetPeriod = targetPeriodNumber <= Number(enrollment.durationPeriods ?? 0)
    ? get<{ id: number; name: string }>(
      "SELECT id, name FROM curricular_periods WHERE sequence = ? AND is_active = 1",
      targetPeriodNumber
    )
    : undefined;
  const billing = buildBilling(enrollment as BillingSource);
  const dueInstallments = billing.schedule.filter((item) => item.status !== "not_due");
  const allOutstanding = dueInstallments.filter((item) => item.status === "pending");
  const latestPaidMonth = [
    ...billing.payments.filter((payment) => payment.concept_type === "tuition").map((payment) => payment.covered_month),
    ...billing.schedule.filter((item) => item.status === "paid" || item.status === "waived").map((item) => item.billingMonth)
  ].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const financialOverride = Boolean(enrollment.financial_clearance_override);
  const overdue = financialOverride ? [] : allOutstanding.filter((item) => !latestPaidMonth || !item.billingMonth || item.billingMonth > latestPaidMonth);
  const lastTwo = dueInstallments.slice(-2);
  const recentTwoPaymentsCovered = financialOverride || (lastTwo.length >= 2 && lastTwo.every((item) => item.status === "paid" || item.status === "waived"));
  const overdueAmount = financialOverride ? 0 : Number(allOutstanding.reduce((sum, item) => sum + Number(item.pendingAmount), 0).toFixed(2));
  const manualRegistration = get<{ status: string }>(
    "SELECT status FROM student_registration_status WHERE enrollment_id = ? AND period_number = ?",
    enrollmentId,
    targetPeriodNumber
  );
  const registrationPaidForTarget = manualRegistration
    ? manualRegistration.status === "paid"
    : Boolean(get(
      `SELECT id FROM student_payments WHERE enrollment_id = ?
       AND (concept_type IN ('enrollment', 'reenrollment') OR lower(concept) LIKE '%inscrip%')
       AND registration_period_number = ? LIMIT 1`,
      enrollmentId,
      targetPeriodNumber
    ));
  const reasons: string[] = [];
  if (!targetPeriod) reasons.push("El alumno ya se encuentra en el último semestre configurado para su plan.");
  if (overdue.length > 2) reasons.push(`Tiene ${overdue.length} mensualidades vencidas por un total de $${overdueAmount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}.`);
  if (!recentTwoPaymentsCovered) reasons.push("No están cubiertas las dos mensualidades exigibles más recientes.");
  if (!registrationPaidForTarget) reasons.push(`No está pagada la inscripción o reinscripción correspondiente al semestre ${targetPeriodNumber}.`);
  return {
    eligible: Boolean(targetPeriod) && overdue.length <= 2 && recentTwoPaymentsCovered && registrationPaidForTarget,
    currentPeriodNumber,
    targetPeriodNumber,
    targetPeriodName: targetPeriod?.name ?? null,
    overdueMonths: overdue.length,
    overdueAmount,
    recentTwoPaymentsCovered,
    registrationPaidForTarget,
    reasons
  };
}
