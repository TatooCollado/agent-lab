CREATE TYPE app_role AS ENUM ('admin', 'viewer');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'leave');

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role app_role NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  department_id uuid NOT NULL REFERENCES departments(id),
  timezone text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  work_date date NOT NULL,
  scheduled_start timestamptz NOT NULL,
  actual_arrival timestamptz,
  status attendance_status NOT NULL,
  absence_reason text,
  source text NOT NULL DEFAULT 'application',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_actual_arrival_consistency CHECK (
    (status = 'present' AND actual_arrival IS NOT NULL)
    OR (status IN ('absent', 'leave') AND actual_arrival IS NULL)
  ),
  UNIQUE (employee_id, work_date)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES app_users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX attendance_records_scheduled_start_idx
  ON attendance_records (scheduled_start);
CREATE INDEX attendance_records_employee_work_date_idx
  ON attendance_records (employee_id, work_date DESC);
CREATE INDEX audit_events_created_at_idx
  ON audit_events (created_at DESC);

CREATE VIEW hr_employee_directory AS
SELECT
  e.id,
  e.employee_number,
  e.first_name,
  e.last_name,
  concat_ws(' ', e.first_name, e.last_name) AS full_name,
  d.code AS department_code,
  d.name AS department_name,
  e.timezone,
  e.active
FROM employees e
JOIN departments d ON d.id = e.department_id;

CREATE VIEW hr_late_arrivals AS
SELECT
  e.id AS employee_id,
  e.employee_number,
  concat_ws(' ', e.first_name, e.last_name) AS full_name,
  d.code AS department_code,
  ar.work_date,
  ar.scheduled_start,
  ar.actual_arrival,
  floor(extract(epoch FROM (ar.actual_arrival - ar.scheduled_start)) / 60)::integer AS late_minutes
FROM attendance_records ar
JOIN employees e ON e.id = ar.employee_id
JOIN departments d ON d.id = e.department_id
WHERE ar.status = 'present'
  AND ar.actual_arrival > ar.scheduled_start;

