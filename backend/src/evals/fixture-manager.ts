import { randomUUID } from "node:crypto";
import { createPool } from "../db/pool.js";

export type FreshnessFixture = {
  employeeId: string;
  employeeNumber: string;
};

export interface EvalFixtureManager {
  createFreshnessFixture(): Promise<FreshnessFixture>;
  cleanupFreshnessFixture(fixture: FreshnessFixture): Promise<void>;
}

export class DatabaseEvalFixtureManager implements EvalFixtureManager {
  async createFreshnessFixture(): Promise<FreshnessFixture> {
    const pool = createPool("admin");
    const client = await pool.connect();
    const employeeNumber = `EVAL-${randomUUID().slice(0, 8).toUpperCase()}`;
    try {
      await client.query("BEGIN");
      const employee = await client.query<{ id: string }>(
        `INSERT INTO employees (employee_number, first_name, last_name, department_id)
         SELECT $1, 'Evaluation', 'Fixture', id
         FROM departments
         ORDER BY code
         LIMIT 1
         RETURNING id`,
        [employeeNumber]
      );
      const employeeId = employee.rows[0]?.id;
      if (!employeeId) throw new Error("No department exists for the evaluation fixture");
      await client.query(
        `INSERT INTO attendance_records (
           employee_id, work_date, scheduled_start, actual_arrival, status, source
         ) VALUES (
           $1,
           (date_trunc('month', current_date) - interval '1 month' + interval '19 days')::date,
           date_trunc('month', current_date) - interval '1 month' + interval '19 days 09 hours',
           date_trunc('month', current_date) - interval '1 month' + interval '19 days 09 hours 15 minutes',
           'present',
           'agent-evaluation'
         )`,
        [employeeId]
      );
      await client.query(
        `INSERT INTO audit_events (action, target_type, target_id, metadata)
         VALUES ('eval.fixture.created', 'employee', $1, $2::jsonb)`,
        [employeeId, JSON.stringify({ employeeNumber })]
      );
      await client.query("COMMIT");
      return { employeeId, employeeNumber };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
      await pool.end();
    }
  }

  async cleanupFreshnessFixture(fixture: FreshnessFixture): Promise<void> {
    const pool = createPool("admin");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM attendance_records WHERE employee_id = $1 AND source = 'agent-evaluation'",
        [fixture.employeeId]
      );
      const deleted = await client.query(
        "DELETE FROM employees WHERE id = $1 AND employee_number = $2",
        [fixture.employeeId, fixture.employeeNumber]
      );
      if (deleted.rowCount !== 1) throw new Error("Evaluation fixture cleanup target did not match exactly one employee");
      await client.query(
        `INSERT INTO audit_events (action, target_type, target_id, metadata)
         VALUES ('eval.fixture.cleaned', 'employee', $1, $2::jsonb)`,
        [fixture.employeeId, JSON.stringify({ employeeNumber: fixture.employeeNumber })]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
      await pool.end();
    }
  }

  async countRemainingFixtures(): Promise<number> {
    const pool = createPool("admin");
    try {
      const result = await pool.query<{ count: string }>(
        `SELECT (
           (SELECT count(*) FROM employees WHERE employee_number LIKE 'EVAL-%') +
           (SELECT count(*) FROM attendance_records WHERE source = 'agent-evaluation')
         )::text AS count`
      );
      return Number(result.rows[0]?.count ?? 0);
    } finally {
      await pool.end();
    }
  }
}
