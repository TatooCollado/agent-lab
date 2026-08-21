import type { Pool } from "pg";
import { createPool } from "./pool.js";

type ExpectedDenial = {
  check: string;
  passed: true;
  postgresCode: string;
};

async function expectDenied(
  pool: Pool,
  check: string,
  sql: string
): Promise<ExpectedDenial> {
  try {
    await pool.query(sql);
  } catch (error) {
    const postgresCode = typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "unknown";
    return { check, passed: true, postgresCode };
  }

  throw new Error(`Permission check unexpectedly succeeded: ${check}`);
}

const readonlyPool = createPool("readonly");
const adminPool = createPool("admin");

try {
  const visibleRows = await readonlyPool.query("SELECT count(*)::integer AS count FROM hr_late_arrivals");
  const results = [
    {
      check: "readonly can query approved HR view",
      passed: visibleRows.rows[0]?.count >= 0
    },
    await expectDenied(
      readonlyPool,
      "readonly cannot query app_users",
      "SELECT id FROM app_users LIMIT 1"
    ),
    await expectDenied(
      readonlyPool,
      "readonly cannot insert departments",
      "INSERT INTO departments (code, name) VALUES ('DENIED', 'Denied')"
    ),
    await expectDenied(
      adminPool,
      "admin cannot drop employee table",
      "DROP TABLE employees"
    )
  ];

  console.info(JSON.stringify(results, null, 2));
} finally {
  await Promise.all([readonlyPool.end(), adminPool.end()]);
}

