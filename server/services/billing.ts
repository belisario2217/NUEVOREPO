import { all } from "../db.js";

export type BillingSource = {
  studentId: number;
  enrollmentId: number | null;
  planId: number | null;
  durationPeriods: number | null;
  tuitionAmount: number | null;
  billingStartDate?: string | null;
  tuitionDueDay?: number | null;
  enrolledAt: string | null;
};

export type PaymentRecord = {
  id: number;
  student_id: number;
  enrollment_id: number | null;
  plan_id: number | null;
  folio: string;
  amount: number;
  paid_at: string;
  payment_method: string | null;
  concept: string;
  concept_type: "tuition" | "enrollment" | "reenrollment" | "other";
  covered_month: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TuitionChargeRecord = {
  id: number;
  student_id: number;
  enrollment_id: number | null;
  billing_month: string;
  due_date: string | null;
  amount: number;
  status: "pending" | "paid" | "waived";
  payment_id: number | null;
  notes: string | null;
};

export type BillingSummary = {
  tuitionAmount: number;
  expectedPayments: number;
  totalInstallments: number;
  accruedInstallments: number;
  expectedAmount: number;
  accruedAmount: number;
  paidAmount: number;
  tuitionPaidAmount: number;
  otherPaidAmount: number;
  balance: number;
  paidInstallments: number;
  pendingInstallments: number;
};

export type TuitionScheduleItem = {
  period: number;
  dueDate: string | null;
  billingMonth: string | null;
  expectedAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: "paid" | "partial" | "pending" | "not_due" | "waived";
};

function money(value: number) {
  return Number(value.toFixed(2));
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function addMonths(dateText: string | null, months: number) {
  if (!dateText) return null;
  const date = new Date(`${dateText.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function monthFromDate(dateText: string | null) {
  return dateText?.slice(0, 7) ?? null;
}

function clampDay(year: number, monthIndex: number, day: number) {
  return Math.min(day, new Date(year, monthIndex + 1, 0).getDate());
}

function dueDate(startDateText: string | null, dueDay: number, months: number) {
  if (!startDateText) return null;
  const start = new Date(`${startDateText.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const date = new Date(start);
  const offset = dueDay < start.getDate() ? 1 : 0;
  date.setMonth(start.getMonth() + months + offset);
  date.setDate(clampDay(date.getFullYear(), date.getMonth(), dueDay));
  return date.toISOString().slice(0, 10);
}

function fallbackInstallments(source: BillingSource) {
  return Math.max(0, Math.trunc(Number(source.durationPeriods ?? 0)) * 6);
}

function fallbackSchedule(source: BillingSource) {
  const tuitionAmount = Math.max(0, Number(source.tuitionAmount ?? 0));
  const totalInstallments = fallbackInstallments(source);
  if (!tuitionAmount || !totalInstallments) return [] as TuitionChargeRecord[];
  const startDate = source.billingStartDate ?? source.enrolledAt;
  const dueDay = Math.max(1, Math.min(31, Math.trunc(Number(source.tuitionDueDay ?? 10))));
  return Array.from({ length: totalInstallments }, (_, index) => {
    const due = dueDate(startDate ?? null, dueDay, index) ?? addMonths(startDate ?? null, index);
    return {
      id: 0,
      student_id: source.studentId,
      enrollment_id: source.enrollmentId,
      billing_month: monthFromDate(due) ?? "",
      due_date: due,
      amount: tuitionAmount,
      status: monthFromDate(due) && monthFromDate(due)! <= currentMonth() ? "pending" : "pending",
      payment_id: null,
      notes: null
    } satisfies TuitionChargeRecord;
  });
}

export function listStudentPayments(source: BillingSource): PaymentRecord[] {
  return all<PaymentRecord>(
    `SELECT id, student_id, enrollment_id, plan_id, folio, amount, paid_at, payment_method, concept,
     COALESCE(concept_type, CASE WHEN lower(concept) LIKE '%colegiatura%' THEN 'tuition' ELSE 'other' END) AS concept_type,
     covered_month, notes, created_at, updated_at
     FROM student_payments
     WHERE student_id = ?
     ORDER BY paid_at DESC, id DESC`,
    source.studentId
  );
}

export function listTuitionCharges(source: BillingSource): TuitionChargeRecord[] {
  const charges = all<TuitionChargeRecord>(
    `SELECT id, student_id, enrollment_id, billing_month, due_date, amount, status, payment_id, notes
     FROM student_tuition_charges
     WHERE student_id = ?
     ORDER BY billing_month, id`,
    source.studentId
  );
  return charges.length ? charges : fallbackSchedule(source);
}

export function summarizeBilling(source: BillingSource, payments: PaymentRecord[], charges: TuitionChargeRecord[]) {
  const tuitionAmount = Math.max(0, Number(source.tuitionAmount ?? charges.find((charge) => charge.amount > 0)?.amount ?? 0));
  const totalInstallments = charges.length;
  const accruedCharges = charges.filter((charge) => charge.billing_month <= currentMonth());
  const paidCharges = charges.filter((charge) => charge.status === "paid" || charge.status === "waived");
  const tuitionPayments = payments.filter((payment) => payment.concept_type === "tuition");
  const paidAmount = money(payments.reduce((sum, payment) => sum + Number(payment.amount), 0));
  const tuitionPaidAmount = money(tuitionPayments.reduce((sum, payment) => sum + Number(payment.amount), 0));
  const expectedAmount = money(charges.reduce((sum, charge) => sum + Number(charge.amount), 0));
  const accruedAmount = money(accruedCharges.reduce((sum, charge) => sum + Number(charge.amount), 0));
  const coveredByStatus = money(paidCharges.reduce((sum, charge) => sum + Number(charge.amount), 0));
  const balance = money(Math.max(0, accruedAmount - Math.max(tuitionPaidAmount, coveredByStatus)));
  return {
    tuitionAmount,
    expectedPayments: totalInstallments,
    totalInstallments,
    accruedInstallments: accruedCharges.length,
    expectedAmount,
    accruedAmount,
    paidAmount,
    tuitionPaidAmount,
    otherPaidAmount: money(paidAmount - tuitionPaidAmount),
    balance,
    paidInstallments: paidCharges.length,
    pendingInstallments: accruedCharges.filter((charge) => charge.status === "pending").length
  } satisfies BillingSummary;
}

export function buildTuitionSchedule(charges: TuitionChargeRecord[], payments: PaymentRecord[]) {
  return charges.map((charge, index) => {
    const payment = charge.payment_id ? payments.find((item) => item.id === charge.payment_id) : null;
    const paidAmount = charge.status === "paid" ? Number(payment?.amount ?? charge.amount) : 0;
    const pendingAmount = charge.status === "pending" && charge.billing_month <= currentMonth()
      ? Math.max(0, Number(charge.amount) - paidAmount)
      : 0;
    return {
      period: index + 1,
      dueDate: charge.due_date,
      billingMonth: charge.billing_month,
      expectedAmount: Number(charge.amount),
      paidAmount: money(paidAmount),
      pendingAmount: money(pendingAmount),
      status: charge.status === "waived" ? "waived" : charge.status === "paid" ? "paid" : charge.billing_month > currentMonth() ? "not_due" : "pending"
    } satisfies TuitionScheduleItem;
  });
}

export function buildBilling(source: BillingSource) {
  const payments = listStudentPayments(source);
  const tuitionCharges = listTuitionCharges(source);
  const summary = summarizeBilling(source, payments, tuitionCharges);
  return {
    summary,
    payments,
    tuitionCharges,
    schedule: buildTuitionSchedule(tuitionCharges, payments)
  };
}
