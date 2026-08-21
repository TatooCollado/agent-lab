import { randomUUID } from "node:crypto";
import type {
  AgentLlm,
  AgentPlan,
  AgentToolDefinition,
} from "../agent/contracts.js";
import { StdioMcpGateway } from "../agent/mcp-gateway.js";
import { HrAgentOrchestrator } from "../agent/orchestrator.js";
import { ProviderResilienceError } from "../resilience/provider-resilience.js";

class FinalizationFailureLlm implements AgentLlm {
  async plan(input: {
    question: string;
    instructions: string;
    tools: AgentToolDefinition[];
  }): Promise<AgentPlan> {
    const tool = input.tools[0];
    if (!tool || tool.name !== "list_late_arrivals") {
      throw new Error("Fault injection received an unexpected capability");
    }
    return {
      model: "fault-injection/finalization",
      calls: [
        {
          callId: "fault-injection-call",
          name: tool.name,
          arguments: {
            period: "previous_calendar_month",
            employeeNumber: null,
          },
        },
      ],
      continuation: null,
    };
  }

  async respond(): Promise<never> {
    throw new ProviderResilienceError("llm_provider_unavailable", 503, true);
  }
}

const agent = new HrAgentOrchestrator(
  new FinalizationFailureLlm(),
  () => new StdioMcpGateway(),
);
const result = await agent.run(
  "¿Qué empleados llegaron tarde durante el último mes?",
  randomUUID(),
);
const degraded = result.trace.find(
  (item) => item.name === "llm.grounded_response.degraded",
);

if (
  result.presentation.kind !== "late_arrivals" ||
  result.presentation.data.count !== 2 ||
  degraded?.status !== "completed" ||
  !result.answer.includes("narrativa del modelo no está disponible")
) {
  throw new Error("Graceful degradation resilience evaluation failed");
}

console.info(
  JSON.stringify({
    status: "ok",
    technique: "controlled fault injection",
    injectedFailure: "llm_provider_unavailable during finalization",
    source: result.presentation.data.source,
    grounded: result.grounded,
    databaseCount: result.presentation.data.count,
    presentationKind: result.presentation.kind,
    traceEvent: degraded.name,
    recovery: (degraded.output as Record<string, unknown>).recovery,
  }),
);
