ALTER TABLE academic_plans ADD COLUMN rvoe TEXT;

UPDATE academic_plans
SET rvoe = '20231665'
WHERE rvoe IS NULL
  AND (
    UPPER(name) LIKE '%ENFERMER%'
    OR program_id IN (SELECT id FROM programs WHERE UPPER(name) LIKE '%ENFERMER%')
  );
