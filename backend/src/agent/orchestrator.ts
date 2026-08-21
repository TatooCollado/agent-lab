import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import type { TraceEvent } from "../observability/trace-event.js";
import type {
  AgentAnswer,
  AgentLlm,
  AgentToolCall,
  AgentToolOutput,
} from "./contracts.js";
import type { McpGateway } from "./mcp-gateway.js";
import { createAnswerPresentation } from "./answer-presentation.js";
import { routeAgentCapability } from "./capability-router.js";
import { HR_AGENT_SYSTEM_PROMPT } from "./system-prompt.js";
import { CONTROLLED_TOOL_CATALOG, controlledTools } from "./tool-catalog.js";
import { ProviderResilienceError } from "../resilience/provider-resilience.js";

export interface AgentRunner {
  run(question: string, requestId: string): Promise<AgentAnswer>;
  resilienceSnapshot?(): unknown;
}

function elapsed(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}

function event(
  requestId: string,
  value: Omit<TraceEvent, "id" | "requestId" | "timestamp">,
): TraceEvent {
  return {
    id: randomUUID(),
    requestId,
    timestamp: new Date().toISOString(),
    ...value,
  };
}

function validateCalls(
  calls: AgentToolCall[],
  allowedToolNames: Set<string>,
): void {
  if (calls.length !== 1) {
    throw new Error(`Expected exactly one tool call, received ${calls.length}`);
  }
  const call = calls[0]!;
  if (
    !CONTROLLED_TOOL_CATALOG.has(call.name) ||
    !allowedToolNames.has(call.name)
  ) {
    throw new Error(`Model selected an unapproved tool: ${call.name}`);
  }
}

export class HrAgentOrchestrator implements AgentRunner {
  constructor(
    private readonly llm: AgentLlm,
    private readonly gatewayFactory: () => McpGateway,
  ) {}

  resilienceSnapshot() {
    return this.llm.resilienceSnapshot?.() ?? { state: "not_exposed" };
  }

  async run(question: string, requestId: string): Promise<AgentAnswer> {
    const trace: TraceEvent[] = [];
    const gateway = this.gatewayFactory();

    trace.push(
      event(requestId, {
        category: "agent",
        name: "agent.request.validated",
        status: "completed",
        technology: "Zod + TypeScript",
        component: "HrAgentOrchestrator",
        concepts: ["Agent", "Input validation"],
        input: { questionLength: question.length },
        output: { accepted: true },
      }),
    );

    try {
      let startedAt = performance.now();
      await gateway.connect();
      const names = await gateway.listToolNames();
      trace.push(
        event(requestId, {
          category: "mcp",
          name: "mcp.tools.discovered",
          status: "completed",
          technology: "Model Context Protocol",
          component: "MCP Client",
          concepts: ["MCP Client", "Tool discovery"],
          input: { transport: "stdio" },
          output: { tools: names },
          durationMs: elapsed(startedAt),
        }),
      );

      const controlled = controlledTools(names);
      trace.push(
        event(requestId, {
          category: "guardrail",
          name: "agent.tools.allowlist.validated",
          status: "completed",
          technology: "TypeScript",
          component: "ControlledToolCatalog",
          concepts: ["Guardrail", "Least privilege"],
          input: { discovered: names },
          output: { allowed: controlled.map((tool) => tool.name) },
        }),
      );

      const routed = routeAgentCapability(question, controlled);
      const tools = routed.tools;
      trace.push(
        event(requestId, {
          category: "guardrail",
          name: "agent.capability.routed",
          status: "completed",
          technology: "Deterministic TypeScript router",
          component: "AgentCapabilityCatalog",
          concepts: ["Capability routing", "Least capability"],
          input: { questionLength: question.length },
          output: {
            capability: routed.capability.id,
            allowedTools: tools.map((tool) => tool.name),
          },
        }),
      );

      startedAt = performance.now();
      const plan = await this.llm.plan({
        question,
        instructions: HR_AGENT_SYSTEM_PROMPT,
        tools,
      });
      validateCalls(plan.calls, new Set(tools.map((tool) => tool.name)));
      trace.push(
        event(requestId, {
          category: "llm",
          name: "llm.tool_selection.completed",
          status: "completed",
          technology: "LLM Tool Calling API",
          component: plan.model,
          concepts: ["LLM", "System Prompt", "Tool Calling"],
          input: { toolChoice: "required", parallelToolCalls: false },
          output: {
            calls: plan.calls.map((call) => ({
              name: call.name,
              arguments: call.arguments,
            })),
          },
          durationMs: elapsed(startedAt),
        }),
      );

      const toolOutputs: AgentToolOutput[] = [];
      for (const call of plan.calls) {
        startedAt = performance.now();
        const output = await gateway.callTool(call.name, call.arguments);
        toolOutputs.push({ callId: call.callId, name: call.name, output });
        trace.push(
          event(requestId, {
            category: "mcp",
            name: "mcp.tool.call.completed",
            status: "completed",
            technology: "Model Context Protocol",
            component: call.name,
            concepts: ["MCP Tool", "Structured Output"],
            input: call.arguments,
            output,
            durationMs: elapsed(startedAt),
          }),
        );
        trace.push(
          event(requestId, {
            category: "database",
            name: "database.source.read",
            status: "completed",
            technology: "PostgreSQL · Neon",
            component: "Read-only HR views",
            concepts: ["Source of Truth", "Fresh query"],
            input: { tool: call.name },
            output: {
              source: output.source,
              count: output.count,
              total: output.total,
            },
          }),
        );
      }

      trace.push(
        event(requestId, {
          category: "guardrail",
          name: "grounding.context.assembled",
          status: "completed",
          technology: "Structured JSON",
          component: "Grounding Guardrail",
          concepts: ["Grounding", "Hallucination control"],
          input: { tools: toolOutputs.map((item) => item.name) },
          output: {
            sources: toolOutputs.map((item) => item.output.source),
            resultCounts: toolOutputs.map((item) => item.output.count),
          },
        }),
      );

      const presentation = createAnswerPresentation(toolOutputs[0]!);
      startedAt = performance.now();
      let final;
      try {
        final = await this.llm.respond({
          question,
          instructions: HR_AGENT_SYSTEM_PROMPT,
          tools,
          plan,
          toolOutputs,
        });
      } catch (error) {
        if (!(error instanceof ProviderResilienceError)) throw error;
        final = {
          answer:
            "Los datos se consultaron correctamente. La narrativa del modelo no está disponible; revisá la respuesta estructurada.",
          model: plan.model,
          recovery: `safe_degradation:${error.code}`,
        };
      }
      const degraded =
        final.recovery?.includes("fallback") ||
        final.recovery?.startsWith("safe_degradation:");
      trace.push(
        event(requestId, {
          category: degraded ? "guardrail" : "llm",
          name: degraded
            ? "llm.grounded_response.degraded"
            : "llm.grounded_response.completed",
          status: "completed",
          technology: degraded ? "Deterministic fallback" : "LLM Chat API",
          component: final.model,
          concepts: [
            "Grounded generation",
            "Function call output",
            "Bounded retry",
            ...(degraded ? ["Graceful degradation"] : []),
          ],
          input: { toolOutputs: toolOutputs.length },
          output: {
            answerLength: final.answer.length,
            recovery: final.recovery ?? "not_required",
          },
          durationMs: elapsed(startedAt),
        }),
      );

      trace.push(
        event(requestId, {
          category: "guardrail",
          name: "presentation.payload.validated",
          status: "completed",
          technology: "Zod discriminated union",
          component: "AnswerPresentation",
          concepts: ["Deterministic presentation", "Schema validation"],
          input: { tool: toolOutputs[0]!.name },
          output: { kind: presentation.kind },
        }),
      );

      return {
        requestId,
        answer: final.answer,
        model: final.model,
        grounded: true,
        toolsUsed: toolOutputs.map((item) => item.name),
        presentation,
        trace,
      };
    } finally {
      await gateway.close();
    }
  }
}
