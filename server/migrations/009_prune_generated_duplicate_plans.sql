DELETE FROM plan_subjects
WHERE plan_id IN (
  SELECT generated.id
  FROM academic_plans generated
  WHERE generated.code LIKE '%-PLAN-2026'
    AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.plan_id = generated.id)
    AND EXISTS (
      SELECT 1
      FROM academic_plans kept
      WHERE kept.program_id = generated.program_id
        AND kept.id <> generated.id
        AND kept.is_active = 1
        AND (kept.code NOT LIKE '%-PLAN-2026' OR kept.id < generated.id)
    )
);

DELETE FROM academic_plans
WHERE code LIKE '%-PLAN-2026'
  AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.plan_id = academic_plans.id)
  AND EXISTS (
    SELECT 1
    FROM academic_plans kept
    WHERE kept.program_id = academic_plans.program_id
      AND kept.id <> academic_plans.id
      AND kept.is_active = 1
      AND (kept.code NOT LIKE '%-PLAN-2026' OR kept.id < academic_plans.id)
  );
