import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import type { TraceEvent } from "../observability/trace-event.js";
import type { AgentAnswer, AgentLlm, AgentToolOutput } from "./contracts.js";
import type { McpGateway } from "./mcp-gateway.js";
import { createAnswerPresentation } from "./answer-presentation.js";
import {
  semanticPlanningTools,
  validateAgentDecision,
} from "./capability-router.js";
import { HR_AGENT_SYSTEM_PROMPT } from "./system-prompt.js";
import { controlledTools } from "./tool-catalog.js";
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

      startedAt = performance.now();
      const planningTools = semanticPlanningTools(controlled);
      const plan = await this.llm.plan({
        question,
        instructions: HR_AGENT_SYSTEM_PROMPT,
        tools: planningTools,
      });
      trace.push(
        event(requestId, {
          category: "llm",
          name: "llm.semantic_proposal.completed",
          status: "completed",
          technology: "LLM Tool Calling API",
          component: plan.model,
          concepts: ["Semantic interpretation", "Tool calling"],
          input: { candidates: planningTools.map((tool) => tool.name) },
          output: {
            proposals: plan.calls.map((call) => ({
              name: call.name,
              arguments: call.arguments,
            })),
          },
          durationMs: elapsed(startedAt),
        }),
      );
      startedAt = performance.now();
      const decision = validateAgentDecision(question, plan.calls, controlled);
      const calls = [decision.call];
      trace.push(
        event(requestId, {
          category: "guardrail",
          name: "agent.semantic_decision.validated",
          status: "completed",
          technology: "LLM proposal + Zod backend validation",
          component: "SemanticDecisionValidator",
          concepts: ["Semantic routing", "Backend validation", "Allowlist"],
          input: {
            proposed: plan.calls.map((call) => call.name),
            availableMcpTools: controlled.map((tool) => tool.name),
          },
          output: {
            capability: decision.capability.id,
            calls: calls.map((call) => ({
              name: call.name,
              arguments: call.arguments,
            })),
          },
          durationMs: elapsed(startedAt),
        }),
      );

      const toolOutputs: AgentToolOutput[] = [];
      for (const call of calls) {
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
          durationMs: elapsed(startedAt),
        }),
      );

      const presentation = createAnswerPresentation(toolOutputs[0]!);
      startedAt = performance.now();
      let final;
      try {
        final = await this.llm.respond({
          question,
          instructions: HR_AGENT_SYSTEM_PROMPT,
          tools: planningTools,
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
