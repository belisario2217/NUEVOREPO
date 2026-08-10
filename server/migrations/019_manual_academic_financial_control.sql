ALTER TABLE groups
ADD COLUMN curricular_period_id INTEGER REFERENCES curricular_periods(id) ON DELETE SET NULL;

ALTER TABLE enrollments
ADD COLUMN financial_clearance_override INTEGER NOT NULL DEFAULT 0 CHECK(financial_clearance_override IN (0, 1));

ALTER TABLE enrollments ADD COLUMN financial_override_note TEXT;
ALTER TABLE enrollments ADD COLUMN financial_override_updated_at TEXT;
ALTER TABLE enrollments ADD COLUMN financial_override_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE student_registration_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  period_number INTEGER NOT NULL CHECK(period_number BETWEEN 1 AND 20),
  status TEXT NOT NULL CHECK(status IN ('paid', 'pending')),
  physical_folio TEXT,
  amount REAL,
  paid_at TEXT,
  payment_id INTEGER REFERENCES student_payments(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(enrollment_id, period_number)
);

UPDATE groups SET curricular_period_id = (
  SELECT e.curricular_period_id
  FROM enrollments e
  WHERE e.group_id = groups.id AND e.is_active = 1 AND e.curricular_period_id IS NOT NULL
  GROUP BY e.curricular_period_id
  ORDER BY COUNT(*) DESC, e.id DESC
  LIMIT 1
) WHERE curricular_period_id IS NULL;

CREATE INDEX idx_registration_status_enrollment_period
ON student_registration_status(enrollment_id, period_number, status);
