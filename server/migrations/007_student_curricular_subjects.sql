CREATE TABLE student_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrollment_id INTEGER REFERENCES enrollments(id) ON DELETE SET NULL,
  plan_id INTEGER REFERENCES academic_plans(id) ON DELETE SET NULL,
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  school_cycle_id INTEGER REFERENCES school_cycles(id) ON DELETE SET NULL,
  semester_number INTEGER NOT NULL DEFAULT 1,
  subject_type TEXT NOT NULL DEFAULT 'mandatory' CHECK(subject_type IN ('mandatory', 'elective')),
  credits REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('pending', 'in_progress', 'completed')),
  final_score REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, subject_id, school_cycle_id, semester_number)
);

CREATE INDEX idx_student_subjects_student ON student_subjects(student_id, semester_number);
CREATE INDEX idx_student_subjects_group_cycle ON student_subjects(enrollment_id, school_cycle_id, semester_number);
