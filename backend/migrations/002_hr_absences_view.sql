CREATE VIEW hr_absences AS
SELECT
  e.id AS employee_id,
  e.employee_number,
  concat_ws(' ', e.first_name, e.last_name) AS full_name,
  d.code AS department_code,
  ar.work_date,
  ar.scheduled_start,
  ar.absence_reason
FROM attendance_records ar
JOIN employees e ON e.id = ar.employee_id
JOIN departments d ON d.id = e.department_id
WHERE ar.status = 'absent';
