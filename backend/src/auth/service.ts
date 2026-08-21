import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Pool } from "pg";
import { createPool } from "../db/pool.js";
import type { SessionUser, UserRole, UserSummary } from "./contracts.js";

export type LoginResult = { token: string; user: SessionUser; expiresAt: Date };
export type ClearDataResult = {
  attendanceRecords: number;
  employees: number;
  departments: number;
};

export interface AuthService {
  login(username: string, password: string): Promise<LoginResult | null>;
  authenticate(token: string): Promise<SessionUser | null>;
  logout(token: string): Promise<void>;
  listUsers(): Promise<UserSummary[]>;
  createUser(input: {
    actor: SessionUser;
    username: string;
    password: string;
    role: UserRole;
  }): Promise<UserSummary>;
  clearHrData(actor: SessionUser): Promise<ClearDataResult>;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class DatabaseAuthService implements AuthService {
  private readonly pool: Pool;

  constructor(private readonly ttlHours: number) {
    this.pool = createPool("admin");
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async login(username: string, password: string): Promise<LoginResult | null> {
    const result = await this.pool.query<{
      id: string;
      username: string;
      password_hash: string;
      role: UserRole;
      active: boolean;
    }>(
      `SELECT id, username, password_hash, role, active
       FROM app_users
       WHERE lower(username) = lower($1)`,
      [username]
    );
    const row = result.rows[0];
    if (!row || !row.active || !(await bcrypt.compare(password, row.password_hash))) {
      return null;
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.ttlHours * 60 * 60 * 1_000);
    await this.pool.query(
      `INSERT INTO app_sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [row.id, tokenHash(token), expiresAt]
    );
    return {
      token,
      expiresAt,
      user: { id: row.id, username: row.username, role: row.role }
    };
  }

  async authenticate(token: string): Promise<SessionUser | null> {
    const result = await this.pool.query<SessionUser>(
      `SELECT u.id, u.username, u.role
       FROM app_sessions s
       JOIN app_users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > now()
         AND u.active = true`,
      [tokenHash(token)]
    );
    return result.rows[0] ?? null;
  }

  async logout(token: string): Promise<void> {
    await this.pool.query(
      `UPDATE app_sessions SET revoked_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash(token)]
    );
  }

  async listUsers(): Promise<UserSummary[]> {
    const result = await this.pool.query<{
      id: string;
      username: string;
      role: UserRole;
      active: boolean;
      created_at: Date;
    }>(
      `SELECT id, username, role, active, created_at
       FROM app_users ORDER BY created_at, username`
    );
    return result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      role: row.role,
      active: row.active,
      createdAt: row.created_at.toISOString()
    }));
  }

  async createUser(input: {
    actor: SessionUser;
    username: string;
    password: string;
    role: UserRole;
  }): Promise<UserSummary> {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{
        id: string;
        username: string;
        role: UserRole;
        active: boolean;
        created_at: Date;
      }>(
        `INSERT INTO app_users (username, password_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id, username, role, active, created_at`,
        [input.username, passwordHash, input.role]
      );
      const user = result.rows[0]!;
      await client.query(
        `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, metadata)
         VALUES ($1, 'user.created', 'app_user', $2, $3::jsonb)`,
        [input.actor.id, user.id, JSON.stringify({ role: user.role })]
      );
      await client.query("COMMIT");
      return {
        id: user.id,
        username: user.username,
        role: user.role,
        active: user.active,
        createdAt: user.created_at.toISOString()
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async clearHrData(actor: SessionUser): Promise<ClearDataResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const attendance = await client.query("DELETE FROM attendance_records");
      const employees = await client.query("DELETE FROM employees");
      const departments = await client.query("DELETE FROM departments");
      const counts = {
        attendanceRecords: attendance.rowCount ?? 0,
        employees: employees.rowCount ?? 0,
        departments: departments.rowCount ?? 0
      };
      await client.query(
        `INSERT INTO audit_events (actor_user_id, action, target_type, metadata)
         VALUES ($1, 'hr_data.cleared', 'hr_dataset', $2::jsonb)`,
        [actor.id, JSON.stringify(counts)]
      );
      await client.query("COMMIT");
      return counts;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
