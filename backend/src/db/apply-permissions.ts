import { createPool } from "./pool.js";
import { loadEnv } from "../config/env.js";

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function passwordFromConnectionString(value: string | undefined, role: string): string {
  if (!value) {
    throw new Error(`Missing connection string for ${role}`);
  }

  const password = decodeURIComponent(new URL(value).password);
  if (!password) {
    throw new Error(`Missing password for ${role}`);
  }
  return password;
}

const pool = createPool("migration");
const client = await pool.connect();
const env = loadEnv();

try {
  await client.query("BEGIN");
  try {
    // Neon Console roles inherit neon_superuser and the project owner cannot
    // revoke that membership. Replace only those fresh runtime roles with
    // ordinary SQL roles while preserving their generated passwords.
    const roleState = await client.query<{ rolname: string; elevated: boolean }>(`
      SELECT
        role.rolname,
        pg_has_role(role.rolname, 'neon_superuser', 'member') AS elevated
      FROM pg_roles role
      WHERE role.rolname IN ('app_readonly', 'app_admin')
    `);

    const roleByName = new Map(roleState.rows.map((role) => [role.rolname, role]));
    const runtimeRoles = [
      { name: "app_readonly", connectionString: env.DATABASE_READONLY_URL },
      { name: "app_admin", connectionString: env.DATABASE_ADMIN_URL }
    ] as const;

    for (const runtimeRole of runtimeRoles) {
      const existing = roleByName.get(runtimeRole.name);
      if (existing?.elevated) {
        throw new Error(
          `Role ${runtimeRole.name} still inherits neon_superuser; remove the Console role first`
        );
      }
      if (existing) continue;

      const password = passwordFromConnectionString(
        runtimeRole.connectionString,
        runtimeRole.name
      );
      await client.query(
        `CREATE ROLE ${runtimeRole.name} LOGIN PASSWORD ${quoteLiteral(password)}`
      );
    }

    await client.query("ALTER ROLE app_readonly SET default_transaction_read_only = on");

    await client.query(`
      REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
        FROM app_readonly, app_admin;
      REVOKE CREATE ON SCHEMA public FROM app_readonly, app_admin;
      GRANT USAGE ON SCHEMA public TO app_readonly, app_admin;

      GRANT SELECT ON hr_employee_directory, hr_late_arrivals, hr_absences
        TO app_readonly;

      GRANT SELECT, INSERT, UPDATE ON app_users
        TO app_admin;
      GRANT SELECT, INSERT, UPDATE, DELETE ON app_sessions
        TO app_admin;
      GRANT SELECT, INSERT ON audit_events
        TO app_admin;
      GRANT SELECT, INSERT, UPDATE ON departments, employees, attendance_records
        TO app_admin;
      GRANT DELETE ON attendance_records, employees, departments
        TO app_admin;
    `);

    const verification = await client.query<{
      rolname: string;
      rolsuper: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
      neon_superuser_member: boolean;
    }>(`
      SELECT
        role.rolname,
        role.rolsuper,
        role.rolcreaterole,
        role.rolcreatedb,
        role.rolreplication,
        role.rolbypassrls,
        pg_has_role(role.rolname, 'neon_superuser', 'member') AS neon_superuser_member
      FROM pg_roles role
      WHERE role.rolname IN ('app_readonly', 'app_admin')
      ORDER BY role.rolname
    `);

    if (verification.rowCount !== 2) {
      throw new Error("Expected both application database roles to exist");
    }

    for (const role of verification.rows) {
      if (
        role.rolsuper ||
        role.rolcreaterole ||
        role.rolcreatedb ||
        role.rolreplication ||
        role.rolbypassrls ||
        role.neon_superuser_member
      ) {
        throw new Error(`Elevated privilege remains on role ${role.rolname}`);
      }
    }

    await client.query("COMMIT");
    console.info("Runtime database roles restricted and verified");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
} finally {
  client.release();
  await pool.end();
}
