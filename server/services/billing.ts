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
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingSummary = {
  tuitionAmount: number;
  expectedPayments: number;
  totalInstallments: number;
  accruedInstallments: number;
  expectedAmount: number;
  accruedAmount: number;
  paidAmount: number;
  balance: number;
  paidInstallments: number;
  pendingInstallments: number;
};

export type TuitionScheduleItem = {
  period: number;
  dueDate: string | null;
  expectedAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: "paid" | "partial" | "pending" | "not_due";
};

function money(value: number) {
  return Number(value.toFixed(2));
}

function addMonths(dateText: string | null, months: number) {
  if (!dateText) return null;
  const date = new Date(`${dateText.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
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

function accruedInstallments(source: BillingSource, totalInstallments: number) {
  const startDate = source.billingStartDate ?? source.enrolledAt;
  const dueDay = Math.max(1, Math.min(31, Math.trunc(Number(source.tuitionDueDay ?? 10))));
  let count = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let index = 0; index < totalInstallments; index++) {
    const due = dueDate(startDate ?? null, dueDay, index);
    if (!due) break;
    const dueAt = new Date(`${due}T00:00:00`);
    if (dueAt <= today) count++;
  }
  return Math.min(totalInstallments, count);
}

export function listStudentPayments(source: BillingSource): PaymentRecord[] {
  return all<PaymentRecord>(
    `SELECT id, student_id, enrollment_id, plan_id, folio, amount, paid_at, payment_method, concept,
     notes, created_at, updated_at
     FROM student_payments
     WHERE student_id = ? AND (? IS NULL OR plan_id = ? OR plan_id IS NULL)
     ORDER BY paid_at DESC, id DESC`,
    source.studentId,
    source.planId,
    source.planId
  );
}

export function summarizeBilling(source: BillingSource, payments: PaymentRecord[]) {
  const tuitionAmount = Math.max(0, Number(source.tuitionAmount ?? 0));
  const totalInstallments = Math.max(0, Math.trunc(Number(source.durationPeriods ?? 0)) * 6);
  const accrued = accruedInstallments(source, totalInstallments);
  const expectedPayments = totalInstallments;
  const expectedAmount = money(tuitionAmount * totalInstallments);
  const accruedAmount = money(tuitionAmount * accrued);
  const paidAmount = money(payments.reduce((sum, payment) => sum + Number(payment.amount), 0));
  const balance = money(Math.max(0, accruedAmount - paidAmount));
  const paidInstallments = tuitionAmount > 0
    ? Math.min(totalInstallments, Math.floor(paidAmount / tuitionAmount))
    : 0;
  return {
    tuitionAmount,
    expectedPayments,
    totalInstallments,
    accruedInstallments: accrued,
    expectedAmount,
    accruedAmount,
    paidAmount,
    balance,
    paidInstallments,
    pendingInstallments: Math.max(0, accrued - paidInstallments)
  } satisfies BillingSummary;
}

export function buildTuitionSchedule(source: BillingSource, summary: BillingSummary) {
  if (!summary.totalInstallments || !summary.tuitionAmount) return [] satisfies TuitionScheduleItem[];
  let remainingPaid = summary.paidAmount;
  const startDate = source.billingStartDate ?? source.enrolledAt;
  const dueDay = Math.max(1, Math.min(31, Math.trunc(Number(source.tuitionDueDay ?? 10))));
  return Array.from({ length: summary.totalInstallments }, (_, index) => {
    const period = index + 1;
    const paidAmount = money(Math.min(summary.tuitionAmount, Math.max(0, remainingPaid)));
    remainingPaid = money(Math.max(0, remainingPaid - summary.tuitionAmount));
    const pendingAmount = money(Math.max(0, summary.tuitionAmount - paidAmount));
    const isAccrued = period <= summary.accruedInstallments;
    return {
      period,
      dueDate: dueDate(startDate, dueDay, index) ?? addMonths(startDate, index),
      expectedAmount: summary.tuitionAmount,
      paidAmount,
      pendingAmount: isAccrued ? pendingAmount : 0,
      status: pendingAmount <= 0 ? "paid" : paidAmount > 0 ? "partial" : isAccrued ? "pending" : "not_due"
    };
  });
}

export function buildBilling(source: BillingSource) {
  const payments = listStudentPayments(source);
  const summary = summarizeBilling(source, payments);
  return {
    summary,
    payments,
    schedule: buildTuitionSchedule(source, summary)
  };
}
