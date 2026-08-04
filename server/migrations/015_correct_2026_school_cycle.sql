-- El ciclo es el intervalo escolar anual; la generación permanece en el nombre
-- del grupo y el avance semestral se guarda en curricular_periods.
UPDATE school_cycles
SET name = '2026B - 2027A',
    start_date = '2026-08-10',
    end_date = '2027-07-31',
    updated_at = CURRENT_TIMESTAMP
WHERE id = (
  SELECT id
  FROM school_cycles
  WHERE name = '2026-2027' OR name LIKE '%2026%2030%'
  ORDER BY is_active DESC,
           CASE WHEN name = '2026-2027' THEN 0 ELSE 1 END,
           id DESC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM school_cycles existing
  WHERE existing.name = '2026B - 2027A'
);

UPDATE school_cycles
SET start_date = '2026-08-10',
    end_date = '2027-07-31',
    updated_at = CURRENT_TIMESTAMP
WHERE name = '2026B - 2027A';
