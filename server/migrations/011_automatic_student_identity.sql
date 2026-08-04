ALTER TABLE academic_plans ADD COLUMN matriculation_code TEXT NOT NULL DEFAULT '';

UPDATE academic_plans
SET matriculation_code = UPPER(
  CASE
    WHEN INSTR(code, '-') > 0
      THEN SUBSTR(code, 1, 1) || SUBSTR(SUBSTR(code, INSTR(code, '-') + 1), 1, 1)
    ELSE SUBSTR(code, 1, 10)
  END
)
WHERE TRIM(matriculation_code) = '';

ALTER TABLE groups ADD COLUMN study_modality TEXT NOT NULL DEFAULT 'escolarizado'
  CHECK(study_modality IN ('escolarizado', 'semiescolarizado', 'complementario'));

ALTER TABLE users ADD COLUMN password_must_change INTEGER NOT NULL DEFAULT 0;
