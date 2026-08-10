import type { AuthUser } from "../auth.js";
import { get } from "../db.js";
import { ApiError } from "../utils.js";

export function isTeacherUser(user: AuthUser | undefined) {
  return user?.roleName === "Docente";
}

export function teacherIdForUser(user: AuthUser | undefined) {
  if (!isTeacherUser(user)) return null;
  const teacher = get<{ id: number }>(
    `SELECT id FROM teachers
     WHERE is_active = 1 AND (email = ? COLLATE NOCASE OR full_name = ? COLLATE NOCASE)
     ORDER BY CASE WHEN email = ? COLLATE NOCASE THEN 0 ELSE 1 END LIMIT 1`,
    user!.email,
    user!.fullName,
    user!.email
  );
  if (!teacher) {
    throw new ApiError(403, "Tu usuario docente no está vinculado con el catálogo de docentes. Verifica que ambos tengan el mismo correo.");
  }
  return teacher.id;
}

export function assertTeacherAssignment(user: AuthUser | undefined, assignmentId: number) {
  const teacherId = teacherIdForUser(user);
  if (teacherId == null) return;
  const assignment = get<{ id: number }>(
    "SELECT id FROM subject_assignments WHERE id = ? AND teacher_id = ? AND is_active = 1",
    assignmentId,
    teacherId
  );
  if (!assignment) throw new ApiError(403, "Solo puedes consultar o modificar los grupos y materias que tienes asignados.");
}
