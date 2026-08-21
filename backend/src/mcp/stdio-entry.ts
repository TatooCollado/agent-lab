import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { loadEnv } from "../config/env.js";
import { createPool } from "../db/pool.js";
import { PostgresHrRepository } from "../repositories/hr-repository.js";
import { createHrMcpServer } from "./server.js";

const env = loadEnv();
const pool = createPool("readonly");

serveStdio(
  () => createHrMcpServer(new PostgresHrRepository(pool), env.APP_TIMEZONE),
  {
    onerror: (error) => console.error("MCP transport error:", error.message)
  }
);

process.stdin.once("end", () => {
  void pool.end();
});
