ALTER TABLE enrollments ADD COLUMN tuition_start_date TEXT;
ALTER TABLE enrollments ADD COLUMN tuition_due_day INTEGER NOT NULL DEFAULT 10 CHECK(tuition_due_day BETWEEN 1 AND 31);

CREATE INDEX idx_enrollments_tuition_config ON enrollments(group_id, tuition_start_date, tuition_due_day);
