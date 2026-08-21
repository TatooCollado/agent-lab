import { calculatePeriod } from "../shared/time/period.js";
import { loadEnv } from "../config/env.js";
import { createPool } from "./pool.js";

const env = loadEnv();
const period = calculatePeriod("previous_calendar_month", { timezone: env.APP_TIMEZONE });
const pool = createPool("readonly");

try {
  const result = await pool.query(
    `SELECT employee_number, full_name, work_date, late_minutes
     FROM hr_late_arrivals
     WHERE scheduled_start >= $1 AND scheduled_start < $2
     ORDER BY work_date, employee_number`,
    [period.startInclusive, period.endExclusive]
  );

  console.info(JSON.stringify({ period, count: result.rowCount, records: result.rows }, null, 2));
} finally {
  await pool.end();
}

