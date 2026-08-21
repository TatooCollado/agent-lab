import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createApp } from "../app.js";
import { loadEnv } from "../config/env.js";
import { A2aFinanceCoordinator } from "./finance-client.js";

const env = loadEnv();
if (!env.A2A_INTERNAL_TOKEN) throw new Error("A2A_INTERNAL_TOKEN is required");

const server = createServer(createApp());
await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(env.PORT, "127.0.0.1", resolve);
});

try {
  const result = await new A2aFinanceCoordinator(
    env.PUBLIC_BASE_URL,
    env.A2A_INTERNAL_TOKEN
  ).run({
    period: "previous_calendar_month",
    currency: "ARS",
    dailyCost: 100000,
    replacementPremiumRate: 0.35,
    productivityLossRate: 0.2
  }, randomUUID());

  if (result.report.source !== "postgresql") throw new Error("Finance report is not grounded in PostgreSQL");
  if (!result.trace.some((item) => item.name === "a2a.agent_card.discovered")) throw new Error("Agent Card discovery was not traced");
  if (!result.trace.some((item) => item.name === "finance.mcp.absences.completed")) throw new Error("Finance agent did not call MCP");
  if (result.delegation.protocol !== "A2A" || result.delegation.artifactName !== "absence-loss-report") throw new Error("A2A task artifact is invalid");

  console.info(JSON.stringify({
    status: "ok",
    protocol: result.delegation.protocol,
    version: result.delegation.protocolVersion,
    transport: result.delegation.transport,
    remoteAgent: result.delegation.remoteAgent,
    taskId: result.delegation.taskId,
    artifact: result.delegation.artifactName,
    source: result.report.source,
    absenceDays: result.report.absenceDays,
    totalEstimatedLoss: result.report.totals.totalEstimatedLoss,
    currency: result.report.assumptions.currency,
    traceEvents: result.trace.length
  }));
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
