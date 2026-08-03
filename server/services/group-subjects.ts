import { all, get, run } from "../db.js";

type EnrollmentContext = {
  id: number;
  student_id: number;
  program_id: number;
  group_id: number;
  cycle_id: number;
  plan_id: number | null;
};

type GroupSubject = {
  subject_id: number;
  subject_type: "mandatory" | "elective";
  credits: number;
  semester_number: number;
};

/**
 * Keeps progress records aligned with the subjects assigned to a group. The
 * group assignment remains the source of truth; student_subjects stores only
 * each student's progress in those subjects.
 */
export function syncEnrollmentGroupSubjects(enrollmentId: number) {
  const enrollment = get<EnrollmentContext>(
    `SELECT id, student_id, program_id, group_id, cycle_id, plan_id
     FROM enrollments WHERE id = ? AND is_active = 1`,
    enrollmentId
  );
  if (!enrollment) return 0;

  const planId = enrollment.plan_id ?? get<{ id: number }>(
    `SELECT id FROM academic_plans
     WHERE program_id = ? AND is_active = 1
     ORDER BY id DESC LIMIT 1`,
    enrollment.program_id
  )?.id ?? null;

  if (planId !== enrollment.plan_id) {
    run("UPDATE enrollments SET plan_id = ? WHERE id = ?", planId, enrollment.id);
  }

  const subjects = all<GroupSubject>(
    `SELECT DISTINCT a.subject_id,
     COALESCE(ps.subject_type, 'mandatory') AS subject_type,
     COALESCE(ps.credits, NULLIF(s.credits, 0), 1) AS credits,
     COALESCE(ps.recommended_period, 1) AS semester_number
     FROM subject_assignments a
     JOIN subjects s ON s.id = a.subject_id
     JOIN academic_periods ap ON ap.id = a.period_id
     LEFT JOIN plan_subjects ps ON ps.plan_id = ? AND ps.subject_id = a.subject_id
     WHERE a.group_id = ? AND a.is_active = 1 AND ap.cycle_id = ?
     ORDER BY semester_number, a.subject_id`,
    planId,
    enrollment.group_id,
    enrollment.cycle_id
  );

  let synced = 0;
  subjects.forEach((subject) => {
    const result = run(
      `INSERT INTO student_subjects(student_id, enrollment_id, plan_id, subject_id, school_cycle_id,
       semester_number, subject_type, credits, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_progress')
       ON CONFLICT(student_id, subject_id, school_cycle_id, semester_number)
       DO UPDATE SET enrollment_id = excluded.enrollment_id, plan_id = excluded.plan_id,
        subject_type = excluded.subject_type, credits = excluded.credits, updated_at = CURRENT_TIMESTAMP`,
      enrollment.student_id,
      enrollment.id,
      planId,
      subject.subject_id,
      enrollment.cycle_id,
      Math.max(1, Number(subject.semester_number ?? 1)),
      subject.subject_type,
      subject.credits
    );
    synced += Number(result.changes);
  });
  return synced;
}

export function syncGroupSubjects(groupId: number) {
  const enrollments = all<{ id: number }>(
    `SELECT e.id FROM enrollments e
     JOIN students st ON st.id = e.student_id
     WHERE e.group_id = ? AND e.is_active = 1 AND st.is_active = 1`,
    groupId
  );
  return enrollments.reduce((total, enrollment) => total + syncEnrollmentGroupSubjects(enrollment.id), 0);
}
