CREATE TABLE curricular_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sequence INTEGER NOT NULL UNIQUE CHECK(sequence > 0),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO curricular_periods(name, sequence) VALUES
  ('PRIMER SEMESTRE', 1),
  ('SEGUNDO SEMESTRE', 2),
  ('TERCER SEMESTRE', 3),
  ('CUARTO SEMESTRE', 4),
  ('QUINTO SEMESTRE', 5),
  ('SEXTO SEMESTRE', 6),
  ('SÉPTIMO SEMESTRE', 7),
  ('OCTAVO SEMESTRE', 8),
  ('NOVENO SEMESTRE', 9),
  ('DÉCIMO SEMESTRE', 10),
  ('UNDÉCIMO SEMESTRE', 11),
  ('DUODÉCIMO SEMESTRE', 12);

ALTER TABLE enrollments
ADD COLUMN curricular_period_id INTEGER REFERENCES curricular_periods(id);

-- Recupera los semestres que antes se guardaban erróneamente como periodos
-- de evaluación ligados al ciclo escolar.
UPDATE enrollments
SET curricular_period_id = (
  SELECT cp.id
  FROM academic_periods ap
  JOIN curricular_periods cp ON cp.sequence = ap.sequence
  WHERE ap.id = enrollments.period_id
    AND UPPER(ap.name) LIKE '%SEMESTRE%'
)
WHERE curricular_period_id IS NULL
  AND EXISTS (
    SELECT 1 FROM academic_periods ap
    WHERE ap.id = enrollments.period_id
      AND UPPER(ap.name) LIKE '%SEMESTRE%'
  );

CREATE INDEX idx_enrollments_curricular_period
ON enrollments(curricular_period_id, cycle_id, is_active);
