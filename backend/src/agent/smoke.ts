import { randomUUID } from "node:crypto";
import type {
  AgentLlm,
  AgentPlan,
  AgentToolDefinition,
  AgentToolOutput,
} from "./contracts.js";
import { StdioMcpGateway } from "./mcp-gateway.js";
import { HrAgentOrchestrator } from "./orchestrator.js";

class DeterministicSmokeLlm implements AgentLlm {
  async plan(input: {
    question: string;
    instructions: string;
    tools: AgentToolDefinition[];
  }): Promise<AgentPlan> {
    if (!input.tools.some((tool) => tool.name === "list_late_arrivals")) {
      throw new Error("Controlled late-arrival tool was not provided");
    }
    return {
      model: "deterministic-smoke-double",
      calls: [
        {
          callId: "smoke-call-1",
          name: "list_late_arrivals",
          arguments: {
            period: "previous_calendar_month",
            employeeNumber: null,
          },
        },
      ],
      continuation: [],
    };
  }

  async respond(input: { toolOutputs: AgentToolOutput[] }) {
    const count = input.toolOutputs[0]?.output.count;
    return {
      answer: `PostgreSQL returned ${String(count)} late arrivals.`,
      model: "deterministic-smoke-double",
    };
  }
}

const agent = new HrAgentOrchestrator(
  new DeterministicSmokeLlm(),
  () => new StdioMcpGateway(),
);
const result = await agent.run(
  "¿Qué empleados llegaron tarde durante el último mes?",
  randomUUID(),
);

const mcpEvent = result.trace.find(
  (item) => item.name === "mcp.tool.call.completed",
);
const output = mcpEvent?.output as Record<string, unknown> | undefined;
if (output?.source !== "postgresql" || output.count !== 2) {
  throw new Error(
    "Expected two seeded late arrivals from PostgreSQL through MCP",
  );
}
if (
  result.presentation.kind !== "late_arrivals" ||
  result.presentation.data.count !== 2
) {
  throw new Error("Stage 9 deterministic presentation regression");
}

console.info(
  JSON.stringify({
    status: "ok",
    runtime: "Agent orchestrator → MCP Client → MCP Server → PostgreSQL",
    llm: "deterministic test double",
    tool: result.toolsUsed[0],
    count: output.count,
    presentation: result.presentation.kind,
    traceEvents: result.trace.length,
  }),
);
