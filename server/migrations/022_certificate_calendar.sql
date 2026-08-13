INSERT INTO academic_calendar_events(
  school_cycle_id, event_type, title, start_date, end_date, description, auto_start_subjects
)
SELECT sc.id, 'class_start', 'Inicio de actividades del periodo', '2026-08-10', '2026-08-10',
       'Fecha inicial usada en constancias de estudios.', 1
FROM school_cycles sc
WHERE sc.name = '2026B - 2027A'
  AND NOT EXISTS (
    SELECT 1 FROM academic_calendar_events ace
    WHERE ace.school_cycle_id = sc.id AND ace.event_type = 'class_start' AND ace.is_active = 1
  );

INSERT INTO academic_calendar_events(
  school_cycle_id, event_type, title, start_date, end_date, description, auto_start_subjects
)
SELECT sc.id, 'vacation', 'Periodo vacacional de invierno', '2026-12-18', '2027-01-04',
       'Periodo vacacional indicado en las constancias institucionales.', 0
FROM school_cycles sc
WHERE sc.name = '2026B - 2027A'
  AND NOT EXISTS (
    SELECT 1 FROM academic_calendar_events ace
    WHERE ace.school_cycle_id = sc.id AND ace.event_type = 'vacation' AND ace.is_active = 1
  );

INSERT INTO academic_calendar_events(
  school_cycle_id, event_type, title, start_date, end_date, description, auto_start_subjects
)
SELECT sc.id, 'cycle_end', 'Fin de actividades del periodo', '2027-01-29', '2027-01-29',
       'Fecha final usada en constancias de estudios.', 0
FROM school_cycles sc
WHERE sc.name = '2026B - 2027A'
  AND NOT EXISTS (
    SELECT 1 FROM academic_calendar_events ace
    WHERE ace.school_cycle_id = sc.id AND ace.event_type = 'cycle_end' AND ace.is_active = 1
  );
