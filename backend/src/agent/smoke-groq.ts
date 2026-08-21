import { randomUUID } from "node:crypto";
import { loadEnv } from "../config/env.js";
import { GroqChatLlm } from "./groq-llm.js";
import { StdioMcpGateway } from "./mcp-gateway.js";
import { HrAgentOrchestrator } from "./orchestrator.js";

const env = loadEnv();
if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

const agent = new HrAgentOrchestrator(
  new GroqChatLlm(env.GROQ_API_KEY, env.GROQ_MODEL),
  () => new StdioMcpGateway()
);
const result = await agent.run(
  "¿Qué empleados llegaron tarde durante el último mes?",
  randomUUID()
);

const databaseEvent = result.trace.find((item) => item.name === "database.source.read");
const output = databaseEvent?.output as Record<string, unknown> | undefined;
if (
  !result.grounded ||
  !result.toolsUsed.includes("list_late_arrivals") ||
  output?.source !== "postgresql" ||
  output.count !== 2
) {
  throw new Error(`Groq grounding mismatch: ${JSON.stringify({
    model: result.model,
    grounded: result.grounded,
    toolsUsed: result.toolsUsed,
    source: output?.source,
    databaseCount: output?.count
  })}`);
}

console.info(JSON.stringify({
  status: "ok",
  provider: "groq",
  model: result.model,
  grounded: result.grounded,
  toolsUsed: result.toolsUsed,
  databaseCount: output.count,
  answer: result.answer,
  traceEvents: result.trace.length
}));
