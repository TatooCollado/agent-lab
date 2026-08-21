import { randomUUID } from "node:crypto";
import { createDefaultAgent } from "./factory.js";

const result = await createDefaultAgent().run(
  "¿Qué empleados llegaron tarde durante el último mes?",
  randomUUID()
);

if (!result.grounded || !result.toolsUsed.includes("list_late_arrivals")) {
  throw new Error("The local agent response was not grounded with list_late_arrivals");
}

const databaseEvent = result.trace.find(
  (item) => item.name === "database.source.read"
);
const output = databaseEvent?.output as Record<string, unknown> | undefined;
if (output?.source !== "postgresql" || output.count !== 2) {
  throw new Error("Local agent did not receive the seeded PostgreSQL records");
}

console.info(
  JSON.stringify({
    status: "ok",
    provider: "ollama",
    model: result.model,
    grounded: result.grounded,
    toolsUsed: result.toolsUsed,
    databaseCount: output.count,
    answer: result.answer,
    traceEvents: result.trace.length
  })
);
