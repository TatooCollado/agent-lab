import { Pool } from "pg";
import { loadEnv } from "../config/env.js";

export type DatabaseAccess = "readonly" | "admin" | "migration";

function connectionStringFor(access: DatabaseAccess): string {
  const env = loadEnv();
  const value = {
    readonly: env.DATABASE_READONLY_URL,
    admin: env.DATABASE_ADMIN_URL,
    migration: env.DATABASE_MIGRATION_URL
  }[access];

  if (!value) {
    throw new Error(`Missing database URL for ${access} access`);
  }

  return value;
}

export function createPool(access: DatabaseAccess): Pool {
  return new Pool({
    connectionString: connectionStringFor(access),
    max: access === "readonly" ? 10 : 2,
    allowExitOnIdle: access === "readonly",
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
}
