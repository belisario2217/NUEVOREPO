ALTER TABLE student_payments ADD COLUMN registration_period_number INTEGER
  CHECK(registration_period_number IS NULL OR registration_period_number BETWEEN 1 AND 20);

UPDATE student_payments SET registration_period_number = CASE
  WHEN concept_type = 'enrollment' THEN 1
  WHEN lower(concept) LIKE '%primer semestre%' OR lower(concept) LIKE '%semestre 1%' THEN 1
  WHEN lower(concept) LIKE '%segundo semestre%' OR lower(concept) LIKE '%semestre 2%' THEN 2
  WHEN lower(concept) LIKE '%tercer semestre%' OR lower(concept) LIKE '%semestre 3%' THEN 3
  WHEN lower(concept) LIKE '%cuarto semestre%' OR lower(concept) LIKE '%semestre 4%' THEN 4
  WHEN lower(concept) LIKE '%quinto semestre%' OR lower(concept) LIKE '%semestre 5%' THEN 5
  WHEN lower(concept) LIKE '%sexto semestre%' OR lower(concept) LIKE '%semestre 6%' THEN 6
  WHEN lower(concept) LIKE '%septimo semestre%' OR lower(concept) LIKE '%séptimo semestre%' OR lower(concept) LIKE '%semestre 7%' THEN 7
  WHEN lower(concept) LIKE '%octavo semestre%' OR lower(concept) LIKE '%semestre 8%' THEN 8
  WHEN lower(concept) LIKE '%noveno semestre%' OR lower(concept) LIKE '%semestre 9%' THEN 9
  WHEN lower(concept) LIKE '%decimo semestre%' OR lower(concept) LIKE '%décimo semestre%' OR lower(concept) LIKE '%semestre 10%' THEN 10
  ELSE NULL
END
WHERE concept_type IN ('enrollment', 'reenrollment') OR lower(concept) LIKE '%inscrip%';

CREATE INDEX idx_student_payments_registration_period
ON student_payments(enrollment_id, registration_period_number, concept_type);
