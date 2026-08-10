CREATE TABLE attendance_months (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES subject_assignments(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK(month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  scheduled_classes INTEGER NOT NULL DEFAULT 0 CHECK(scheduled_classes >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'confirmed')),
  confirmed_at TEXT,
  confirmed_by INTEGER REFERENCES users(id),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(assignment_id, month)
);

CREATE TABLE attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attendance_month_id INTEGER NOT NULL REFERENCES attendance_months(id) ON DELETE CASCADE,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  attended_classes INTEGER NOT NULL DEFAULT 0 CHECK(attended_classes >= 0),
  notes TEXT,
  updated_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(attendance_month_id, enrollment_id)
);

CREATE INDEX idx_attendance_months_assignment ON attendance_months(assignment_id, month);
CREATE INDEX idx_attendance_records_enrollment ON attendance_records(enrollment_id);

INSERT OR IGNORE INTO permissions(code, name, module)
VALUES ('attendance.view', 'Consultar asistencia', 'attendance');
INSERT OR IGNORE INTO permissions(code, name, module)
VALUES ('attendance.manage', 'Capturar y confirmar asistencia', 'attendance');

INSERT OR IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('Administrador', 'Coordinador académico', 'Coordinador acadÃ©mico', 'Docente', 'Control escolar')
AND p.code = 'attendance.view';

INSERT OR IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('Administrador', 'Coordinador académico', 'Coordinador acadÃ©mico', 'Docente')
AND p.code = 'attendance.manage';
