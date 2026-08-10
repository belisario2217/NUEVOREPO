ALTER TABLE student_subjects
ADD COLUMN status_manual_override INTEGER NOT NULL DEFAULT 0 CHECK(status_manual_override IN (0, 1));

CREATE TABLE academic_calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_cycle_id INTEGER REFERENCES school_cycles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK(event_type IN (
    'class_start', 'evaluation', 'enrollment', 'reenrollment',
    'vacation', 'resumption', 'cycle_end', 'other'
  )),
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  description TEXT,
  auto_start_subjects INTEGER NOT NULL DEFAULT 0 CHECK(auto_start_subjects IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(end_date >= start_date)
);

CREATE INDEX idx_academic_calendar_cycle_dates
ON academic_calendar_events(school_cycle_id, start_date, end_date, is_active);
