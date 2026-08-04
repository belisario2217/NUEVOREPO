ALTER TABLE groups
ADD COLUMN active_cycle_id INTEGER REFERENCES school_cycles(id) ON DELETE SET NULL;

ALTER TABLE groups
ADD COLUMN plan_id INTEGER REFERENCES academic_plans(id) ON DELETE SET NULL;

-- El ciclo de formación del grupo se conserva en cycle_id. Estos campos
-- representan el contexto académico que cursan actualmente sus alumnos.
UPDATE groups
SET active_cycle_id = COALESCE(
  (
    SELECT e.cycle_id
    FROM enrollments e
    WHERE e.group_id = groups.id AND e.is_active = 1
    ORDER BY e.enrolled_at DESC, e.id DESC
    LIMIT 1
  ),
  cycle_id
)
WHERE active_cycle_id IS NULL;

UPDATE groups
SET plan_id = (
  SELECT e.plan_id
  FROM enrollments e
  WHERE e.group_id = groups.id
    AND e.is_active = 1
    AND e.plan_id IS NOT NULL
  ORDER BY e.enrolled_at DESC, e.id DESC
  LIMIT 1
)
WHERE plan_id IS NULL;

CREATE INDEX idx_groups_active_context
ON groups(active_cycle_id, plan_id, is_active);
