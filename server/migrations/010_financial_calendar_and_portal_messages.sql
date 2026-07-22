ALTER TABLE student_payments ADD COLUMN concept_type TEXT NOT NULL DEFAULT 'other'
  CHECK(concept_type IN ('tuition', 'enrollment', 'reenrollment', 'other'));

ALTER TABLE student_payments ADD COLUMN covered_month TEXT;

UPDATE student_payments
SET concept_type = CASE
  WHEN lower(concept) LIKE '%colegiatura%' THEN 'tuition'
  WHEN lower(concept) LIKE '%reinscripcion%' OR lower(concept) LIKE '%reinscripci%' THEN 'reenrollment'
  WHEN lower(concept) LIKE '%inscripcion%' OR lower(concept) LIKE '%inscripci%' THEN 'enrollment'
  ELSE 'other'
END
WHERE concept_type = 'other';

CREATE TABLE student_tuition_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrollment_id INTEGER REFERENCES enrollments(id) ON DELETE SET NULL,
  billing_month TEXT NOT NULL CHECK(billing_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  due_date TEXT,
  amount REAL NOT NULL CHECK(amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'waived')),
  payment_id INTEGER REFERENCES student_payments(id) ON DELETE SET NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, billing_month)
);

CREATE INDEX idx_tuition_charges_student_month ON student_tuition_charges(student_id, billing_month);
CREATE INDEX idx_tuition_charges_status ON student_tuition_charges(status, billing_month);

CREATE TABLE portal_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK(target_type IN ('all', 'group', 'student')),
  target_id INTEGER,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'info' CHECK(priority IN ('info', 'warning', 'urgent')),
  starts_at TEXT,
  ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_portal_messages_scope ON portal_messages(target_type, target_id, is_active);

INSERT OR IGNORE INTO permissions(code, name, module) VALUES
  ('tuition.manage', 'Administrar colegiaturas mensuales', 'payments'),
  ('messages.view', 'Consultar mensajes del portal', 'messages'),
  ('messages.manage', 'Administrar mensajes del portal', 'messages');

INSERT OR IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('Administrador', 'Coordinador academico', 'Coordinador académico')
  AND p.code IN ('tuition.manage', 'messages.view', 'messages.manage');
