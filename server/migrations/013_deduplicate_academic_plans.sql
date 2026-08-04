-- Conserva un solo plan cuando el plan inicial generado compite con uno administrado
-- en el catálogo, sin perder inscripciones, pagos, materias ni historial curricular.
CREATE TEMP TABLE academic_plan_merge (
  old_id INTEGER PRIMARY KEY,
  new_id INTEGER NOT NULL
);

INSERT INTO academic_plan_merge(old_id, new_id)
SELECT generated.id,
       (
         SELECT kept.id
         FROM academic_plans kept
         WHERE kept.program_id = generated.program_id
         ORDER BY kept.is_active DESC,
                  CASE WHEN kept.code NOT LIKE '%-PLAN-2026' THEN 0 ELSE 1 END,
                  kept.id
         LIMIT 1
       )
FROM academic_plans generated
WHERE generated.code LIKE '%-PLAN-2026'
  AND generated.id <> (
    SELECT kept.id
    FROM academic_plans kept
    WHERE kept.program_id = generated.program_id
    ORDER BY kept.is_active DESC,
             CASE WHEN kept.code NOT LIKE '%-PLAN-2026' THEN 0 ELSE 1 END,
             kept.id
    LIMIT 1
  );

INSERT OR IGNORE INTO plan_subjects(plan_id, subject_id, subject_type, credits, recommended_period)
SELECT merge.new_id, ps.subject_id, ps.subject_type, ps.credits, ps.recommended_period
FROM plan_subjects ps
JOIN academic_plan_merge merge ON merge.old_id = ps.plan_id;

UPDATE enrollments
SET plan_id = (SELECT new_id FROM academic_plan_merge WHERE old_id = enrollments.plan_id)
WHERE plan_id IN (SELECT old_id FROM academic_plan_merge);

UPDATE student_payments
SET plan_id = (SELECT new_id FROM academic_plan_merge WHERE old_id = student_payments.plan_id)
WHERE plan_id IN (SELECT old_id FROM academic_plan_merge);

UPDATE student_subjects
SET plan_id = (SELECT new_id FROM academic_plan_merge WHERE old_id = student_subjects.plan_id)
WHERE plan_id IN (SELECT old_id FROM academic_plan_merge);

DELETE FROM academic_plans WHERE id IN (SELECT old_id FROM academic_plan_merge);
DELETE FROM academic_plan_merge;

-- Une también repeticiones exactas del mismo programa, nombre y versión.
INSERT INTO academic_plan_merge(old_id, new_id)
SELECT id, canonical_id
FROM (
  SELECT ap.id,
         FIRST_VALUE(ap.id) OVER (
           PARTITION BY ap.program_id, LOWER(TRIM(ap.name)), LOWER(TRIM(ap.version))
           ORDER BY ap.is_active DESC, ap.id
         ) AS canonical_id,
         ROW_NUMBER() OVER (
           PARTITION BY ap.program_id, LOWER(TRIM(ap.name)), LOWER(TRIM(ap.version))
           ORDER BY ap.is_active DESC, ap.id
         ) AS duplicate_number
  FROM academic_plans ap
)
WHERE duplicate_number > 1;

INSERT OR IGNORE INTO plan_subjects(plan_id, subject_id, subject_type, credits, recommended_period)
SELECT merge.new_id, ps.subject_id, ps.subject_type, ps.credits, ps.recommended_period
FROM plan_subjects ps
JOIN academic_plan_merge merge ON merge.old_id = ps.plan_id;

UPDATE enrollments
SET plan_id = (SELECT new_id FROM academic_plan_merge WHERE old_id = enrollments.plan_id)
WHERE plan_id IN (SELECT old_id FROM academic_plan_merge);

UPDATE student_payments
SET plan_id = (SELECT new_id FROM academic_plan_merge WHERE old_id = student_payments.plan_id)
WHERE plan_id IN (SELECT old_id FROM academic_plan_merge);

UPDATE student_subjects
SET plan_id = (SELECT new_id FROM academic_plan_merge WHERE old_id = student_subjects.plan_id)
WHERE plan_id IN (SELECT old_id FROM academic_plan_merge);

DELETE FROM academic_plans WHERE id IN (SELECT old_id FROM academic_plan_merge);
DROP TABLE academic_plan_merge;

CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_plans_program_name_version
ON academic_plans(program_id, LOWER(TRIM(name)), LOWER(TRIM(version)));
