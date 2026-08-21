-- Reference only. The executable source of truth is src/db/apply-permissions.ts.
-- On Neon, create runtime roles with SQL instead of the Console when possible:
-- roles created through the Console inherit neon_superuser and must have that
-- membership explicitly revoked before application use.

-- The Neon project owner cannot revoke neon_superuser. If roles were created
-- in the Console, replace them with ordinary SQL roles first. The automated
-- script does this while preserving their generated passwords.
ALTER ROLE app_readonly SET default_transaction_read_only = on;

-- Replace agent_lab with the database name assigned by the cloud provider.
GRANT CONNECT ON DATABASE agent_lab TO app_readonly, app_admin;
GRANT USAGE ON SCHEMA public TO app_readonly, app_admin;

GRANT SELECT ON hr_employee_directory, hr_late_arrivals TO app_readonly;

GRANT SELECT, INSERT, UPDATE ON app_users TO app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_sessions TO app_admin;
GRANT SELECT, INSERT ON audit_events TO app_admin;
GRANT SELECT, INSERT, UPDATE ON departments, employees, attendance_records TO app_admin;
GRANT DELETE ON attendance_records, employees, departments TO app_admin;

-- Do not grant SELECT on every future table. Read-only access is intentionally
-- limited to the explicit HR views above.
