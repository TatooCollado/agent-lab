import bcrypt from "bcryptjs";
import { loadEnv } from "../config/env.js";
import { createPool } from "./pool.js";

const env = loadEnv();
if (!env.SEED_ADMIN_PASSWORD || !env.SEED_VIEWER_PASSWORD) {
  throw new Error("SEED_ADMIN_PASSWORD and SEED_VIEWER_PASSWORD are required");
}

const pool = createPool("admin");
const client = await pool.connect();

try {
  const adminHash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12);
  const viewerHash = await bcrypt.hash(env.SEED_VIEWER_PASSWORD, 12);

  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO app_users (username, password_hash, role)
       VALUES ('admin', $1, 'admin'), ('viewer', $2, 'viewer')
       ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           active = true,
           updated_at = now()`,
      [adminHash, viewerHash]
    );

    await client.query(`
      INSERT INTO departments (code, name)
      VALUES ('ENG', 'Engineering'), ('OPS', 'Operations'), ('FIN', 'Finance')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    `);

    await client.query(`
      INSERT INTO employees (employee_number, first_name, last_name, department_id, timezone)
      SELECT seed.employee_number, seed.first_name, seed.last_name, d.id, $1
      FROM (VALUES
        ('EMP-001', 'Ana', 'Torres', 'ENG'),
        ('EMP-002', 'Bruno', 'Silva', 'OPS'),
        ('EMP-003', 'Carla', 'Méndez', 'FIN')
      ) AS seed(employee_number, first_name, last_name, department_code)
      JOIN departments d ON d.code = seed.department_code
      ON CONFLICT (employee_number) DO UPDATE
      SET first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          department_id = EXCLUDED.department_id,
          timezone = EXCLUDED.timezone,
          active = true,
          updated_at = now()
    `, [env.APP_TIMEZONE]);

    await client.query(`
      DELETE FROM attendance_records
      WHERE source = 'demo-seed'
    `);

    await client.query(`
      INSERT INTO attendance_records (
        employee_id, work_date, scheduled_start, actual_arrival, status, source
      )
      SELECT e.id, seed.work_date, seed.scheduled_start, seed.actual_arrival,
             seed.status::attendance_status, 'demo-seed'
      FROM (
        SELECT 'EMP-001' employee_number,
               (date_trunc('month', current_date) - interval '1 month' + interval '4 days')::date work_date,
               date_trunc('month', current_date) - interval '1 month' + interval '4 days 09 hours' scheduled_start,
               date_trunc('month', current_date) - interval '1 month' + interval '4 days 09 hours 18 minutes' actual_arrival,
               'present' status
        UNION ALL
        SELECT 'EMP-002',
               (date_trunc('month', current_date) - interval '1 month' + interval '9 days')::date,
               date_trunc('month', current_date) - interval '1 month' + interval '9 days 08 hours',
               date_trunc('month', current_date) - interval '1 month' + interval '9 days 08 hours 42 minutes',
               'present'
        UNION ALL
        SELECT 'EMP-003',
               (date_trunc('month', current_date) - interval '1 month' + interval '14 days')::date,
               date_trunc('month', current_date) - interval '1 month' + interval '14 days 09 hours',
               NULL,
               'absent'
      ) seed
      JOIN employees e ON e.employee_number = seed.employee_number
    `);

    await client.query("COMMIT");
    console.info("Seed completed: admin, viewer, employees and attendance demo data");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
} finally {
  client.release();
  await pool.end();
}

