import { Router } from "express";
import { logActivity, requirePermission, type AuthenticatedRequest } from "../auth.js";
import { all, get, run, transaction } from "../db.js";
import { evaluationEligibility } from "../services/evaluation-eligibility.js";
import { assertTeacherAssignment, teacherIdForUser } from "../services/teacher-scope.js";
import { ApiError, asId, cleanText, optionalText } from "../utils.js";

export const attendanceRouter = Router();

function validMonth(value: unknown) {
  const month = cleanText(value, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ApiError(400, "Selecciona un mes válido.");
  return month;
}

function assignmentDetails(assignmentId: number) {
  return get<any>(
    `SELECT a.id, a.subject_id, s.code AS subject_code, s.name AS subject_name,
     a.group_id, g.name AS group_name, g.study_modality, a.teacher_id,
     t.full_name AS teacher_name, a.period_id, ap.name AS period_name,
     ap.start_date AS period_start_date, ap.end_date AS period_end_date, sc.name AS cycle_name
     FROM subject_assignments a
     JOIN subjects s ON s.id = a.subject_id
     JOIN groups g ON g.id = a.group_id
     JOIN teachers t ON t.id = a.teacher_id
     JOIN academic_periods ap ON ap.id = a.period_id
     JOIN school_cycles sc ON sc.id = ap.cycle_id
     WHERE a.id = ? AND a.is_active = 1`,
    assignmentId
  );
}

attendanceRouter.get("/assignments", requirePermission("attendance.view"), (req: AuthenticatedRequest, res) => {
  const teacherId = teacherIdForUser(req.user);
  const where = teacherId == null ? "a.is_active = 1" : "a.is_active = 1 AND a.teacher_id = ?";
  res.json(all<any>(
    `SELECT a.id, s.code AS subject_code, s.name AS subject_name, g.name AS group_name,
     g.study_modality, t.full_name AS teacher_name, ap.name AS period_name, sc.name AS cycle_name
     FROM subject_assignments a
     JOIN subjects s ON s.id = a.subject_id JOIN groups g ON g.id = a.group_id
     JOIN teachers t ON t.id = a.teacher_id JOIN academic_periods ap ON ap.id = a.period_id
     JOIN school_cycles sc ON sc.id = ap.cycle_id
     WHERE ${where} ORDER BY sc.start_date DESC, g.name, s.name`,
    ...(teacherId == null ? [] : [teacherId])
  ));
});

attendanceRouter.get("/assignment/:id", requirePermission("attendance.view"), (req: AuthenticatedRequest, res) => {
  const assignmentId = asId(req.params.id, "Materia asignada");
  assertTeacherAssignment(req.user, assignmentId);
  const month = validMonth(req.query.month);
  const assignment = assignmentDetails(assignmentId);
  if (!assignment) throw new ApiError(404, "No se encontró la materia asignada.");
  const attendanceMonth = get<any>(
    "SELECT * FROM attendance_months WHERE assignment_id = ? AND month = ?",
    assignmentId,
    month
  );
  const students = all<any>(
    `SELECT e.id AS enrollment_id, st.id AS student_id, st.student_number,
     TRIM(st.first_name || ' ' || st.last_name || ' ' || COALESCE(st.second_last_name, '')) AS student_name,
     COALESCE(ar.attended_classes, 0) AS attended_classes, ar.notes
     FROM enrollments e JOIN students st ON st.id = e.student_id
     LEFT JOIN attendance_records ar ON ar.enrollment_id = e.id AND ar.attendance_month_id = ?
     WHERE e.group_id = ? AND e.is_active = 1 AND st.is_active = 1
     ORDER BY st.last_name, st.second_last_name, st.first_name`,
    attendanceMonth?.id ?? -1,
    assignment.group_id
  );
  res.json({
    assignment,
    month,
    attendanceMonth: attendanceMonth ?? { scheduled_classes: 0, status: "draft", confirmed_at: null },
    students: students.map((student) => ({
      ...student,
      eligibility: evaluationEligibility(assignmentId, student.enrollment_id)
    }))
  });
});

attendanceRouter.put("/assignment/:id", requirePermission("attendance.manage"), (req: AuthenticatedRequest, res) => {
  const assignmentId = asId(req.params.id, "Materia asignada");
  assertTeacherAssignment(req.user, assignmentId);
  const assignment = assignmentDetails(assignmentId);
  if (!assignment) throw new ApiError(404, "No se encontró la materia asignada.");
  const month = validMonth(req.body.month);
  const scheduledClasses = Number(req.body.scheduledClasses);
  if (!Number.isInteger(scheduledClasses) || scheduledClasses < 1 || scheduledClasses > 31) {
    throw new ApiError(400, "El total mensual de clases debe estar entre 1 y 31.");
  }
  const records = Array.isArray(req.body.records) ? req.body.records : [];
  const validEnrollments = new Set(all<{ id: number }>(
    "SELECT id FROM enrollments WHERE group_id = ? AND is_active = 1",
    assignment.group_id
  ).map((row) => row.id));
  if (!records.length) throw new ApiError(400, "Incluye la asistencia de los alumnos del grupo.");
  const confirm = Boolean(req.body.confirm);
  const attendanceMonthId = transaction(() => {
    run(
      `INSERT INTO attendance_months(assignment_id, month, scheduled_classes, status, confirmed_at, confirmed_by, created_by)
       VALUES (?, ?, ?, ?, CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END, ?, ?)
       ON CONFLICT(assignment_id, month) DO UPDATE SET scheduled_classes = excluded.scheduled_classes,
        status = excluded.status, confirmed_at = excluded.confirmed_at, confirmed_by = excluded.confirmed_by,
        updated_at = CURRENT_TIMESTAMP`,
      assignmentId, month, scheduledClasses, confirm ? "confirmed" : "draft", confirm ? 1 : 0,
      confirm ? req.user!.id : null, req.user!.id
    );
    const attendanceMonth = get<{ id: number }>(
      "SELECT id FROM attendance_months WHERE assignment_id = ? AND month = ?",
      assignmentId,
      month
    )!;
    for (const item of records) {
      const enrollmentId = asId(item.enrollmentId, "Inscripción del alumno");
      if (!validEnrollments.has(enrollmentId)) throw new ApiError(400, "Uno de los alumnos no pertenece al grupo asignado.");
      const attendedClasses = Number(item.attendedClasses);
      if (!Number.isInteger(attendedClasses) || attendedClasses < 0 || attendedClasses > scheduledClasses) {
        throw new ApiError(400, `Las asistencias deben estar entre 0 y ${scheduledClasses}.`);
      }
      run(
        `INSERT INTO attendance_records(attendance_month_id, enrollment_id, attended_classes, notes, updated_by)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(attendance_month_id, enrollment_id) DO UPDATE SET
          attended_classes = excluded.attended_classes, notes = excluded.notes,
          updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
        attendanceMonth.id, enrollmentId, attendedClasses, optionalText(item.notes, 500), req.user!.id
      );
    }
    return attendanceMonth.id;
  });
  logActivity(req, confirm ? "confirm-monthly-attendance" : "save-monthly-attendance", "attendance_months", attendanceMonthId, {
    assignmentId, month, scheduledClasses, students: records.length
  });
  res.json({ message: confirm ? "Asistencia mensual confirmada." : "Borrador de asistencia guardado.", attendanceMonthId });
});
