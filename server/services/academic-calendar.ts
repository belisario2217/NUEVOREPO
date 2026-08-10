import { all, get, run } from "../db.js";

type PendingSubject = {
  id: number;
  cycle_id: number;
  cycle_start: string;
  cycle_end: string;
};

function localDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function academicStatusForCycle(cycleId: number): "pending" | "in_progress" {
  const today = localDate();
  const cycle = get<{ start_date: string; end_date: string }>(
    "SELECT start_date, end_date FROM school_cycles WHERE id = ?",
    cycleId
  );
  if (!cycle || today > cycle.end_date) return "pending";
  const configured = all<{ start_date: string }>(
    `SELECT start_date FROM academic_calendar_events
     WHERE (school_cycle_id = ? OR school_cycle_id IS NULL) AND is_active = 1 AND auto_start_subjects = 1 ORDER BY start_date`,
    cycleId
  );
  const started = configured.length
    ? configured.some((event) => event.start_date <= today)
    : cycle.start_date <= today;
  return started ? "in_progress" : "pending";
}

export function syncAcademicSubjectStatuses() {
  const today = localDate();
  const pending = all<PendingSubject>(
    `SELECT ss.id, sc.id AS cycle_id, sc.start_date AS cycle_start, sc.end_date AS cycle_end
     FROM student_subjects ss
     JOIN enrollments e ON e.id = ss.enrollment_id AND e.is_active = 1
     JOIN curricular_periods cp ON cp.id = e.curricular_period_id AND cp.sequence = ss.semester_number
     JOIN school_cycles sc ON sc.id = COALESCE(ss.school_cycle_id, e.cycle_id)
     JOIN students st ON st.id = ss.student_id AND st.is_active = 1
     WHERE ss.status = 'pending' AND ss.status_manual_override = 0`
  );
  const automaticEvents = all<{ school_cycle_id: number | null; start_date: string }>(
    `SELECT school_cycle_id, start_date FROM academic_calendar_events
     WHERE is_active = 1 AND auto_start_subjects = 1
     ORDER BY start_date`
  );
  const eligibleIds = pending.filter((subject) => {
    if (today > subject.cycle_end) return false;
    const configured = automaticEvents.filter((event) => event.school_cycle_id == null || event.school_cycle_id === subject.cycle_id);
    return configured.length
      ? configured.some((event) => event.start_date <= today)
      : subject.cycle_start <= today;
  }).map((subject) => subject.id);
  if (!eligibleIds.length) return 0;
  const result = run(
    `UPDATE student_subjects SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
     WHERE id IN (${eligibleIds.map(() => "?").join(",")}) AND status = 'pending' AND status_manual_override = 0`,
    ...eligibleIds
  );
  return Number(result.changes);
}
