import { randomUUID } from "node:crypto";
import { loadEnv } from "../config/env.js";
import { GroqChatLlm } from "./groq-llm.js";
import { StdioMcpGateway } from "./mcp-gateway.js";
import { HrAgentOrchestrator } from "./orchestrator.js";

const env = loadEnv();
if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

const agent = new HrAgentOrchestrator(
  new GroqChatLlm(env.GROQ_API_KEY, env.GROQ_MODEL),
  () => new StdioMcpGateway(),
);
const lateArrivalResult = await agent.run(
  "¿Qué empleados llegaron tarde durante el último mes?",
  randomUUID(),
);

const databaseEvent = lateArrivalResult.trace.find(
  (item) => item.name === "database.source.read",
);
const output = databaseEvent?.output as Record<string, unknown> | undefined;
if (
  !lateArrivalResult.grounded ||
  !lateArrivalResult.toolsUsed.includes("list_late_arrivals") ||
  output?.source !== "postgresql" ||
  output.count !== 2
) {
  throw new Error(
    `Groq grounding mismatch: ${JSON.stringify({
      model: lateArrivalResult.model,
      grounded: lateArrivalResult.grounded,
      toolsUsed: lateArrivalResult.toolsUsed,
      source: output?.source,
      databaseCount: output?.count,
    })}`,
  );
}

const employeeCountResult = await agent.run(
  "¿Cuántos empleados hay?",
  randomUUID(),
);
const employeeCountEvent = employeeCountResult.trace.find(
  (item) => item.name === "database.source.read",
);
const employeeCountOutput = employeeCountEvent?.output as
  | Record<string, unknown>
  | undefined;
if (
  !employeeCountResult.grounded ||
  !employeeCountResult.toolsUsed.includes("count_employees") ||
  employeeCountOutput?.source !== "postgresql" ||
  employeeCountOutput.count !== 3
) {
  throw new Error(
    `Groq employee count mismatch: ${JSON.stringify({
      model: employeeCountResult.model,
      grounded: employeeCountResult.grounded,
      toolsUsed: employeeCountResult.toolsUsed,
      source: employeeCountOutput?.source,
      databaseCount: employeeCountOutput?.count,
    })}`,
  );
}

console.info(
  JSON.stringify({
    status: "ok",
    provider: "groq",
    model: lateArrivalResult.model,
    cases: [
      {
        question: "late-arrivals",
        toolsUsed: lateArrivalResult.toolsUsed,
        databaseCount: output.count,
        answer: lateArrivalResult.answer,
        traceEvents: lateArrivalResult.trace.length,
      },
      {
        question: "employee-count",
        toolsUsed: employeeCountResult.toolsUsed,
        databaseCount: employeeCountOutput.count,
        answer: employeeCountResult.answer,
        traceEvents: employeeCountResult.trace.length,
      },
    ],
  }),
);
