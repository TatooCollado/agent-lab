import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  Role,
  TaskState,
  type Artifact,
  type Task,
  type TaskArtifactUpdateEvent,
  type TaskStatusUpdateEvent,
} from "@a2a-js/sdk";
import {
  AgentEvent,
  type AgentExecutor,
  type ExecutionEventBus,
  type RequestContext,
} from "@a2a-js/sdk/server";
import type { AgentRunner } from "../agent/orchestrator.js";
import type { McpGateway } from "../agent/mcp-gateway.js";
import { absencesOutputSchema } from "../mcp/contracts.js";
import type { TraceEvent } from "../observability/trace-event.js";
import { calculateAbsenceLossReport } from "../finance/calculator.js";
import {
  financeA2aPayloadSchema,
  financeAgentResultSchema,
} from "../finance/contracts.js";

function trace(
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

function initialTask(context: RequestContext): Task {
  return (
    context.task ?? {
      id: context.taskId,
      contextId: context.contextId,
      status: {
        state: TaskState.TASK_STATE_SUBMITTED,
        timestamp: new Date().toISOString(),
        message: undefined,
      },
      artifacts: [],
      history: [context.userMessage],
      metadata: context.userMessage.metadata,
    }
  );
}

function status(
  context: RequestContext,
  state: TaskState,
  text?: string,
): TaskStatusUpdateEvent {
  return {
    taskId: context.taskId,
    contextId: context.contextId,
    status: {
      state,
      timestamp: new Date().toISOString(),
      message: text
        ? {
            messageId: randomUUID(),
            contextId: context.contextId,
            taskId: context.taskId,
            role: Role.ROLE_AGENT,
            parts: [
              {
                content: { $case: "text", value: text },
                metadata: undefined,
                filename: "",
                mediaType: "text/plain",
              },
            ],
            metadata: {},
            extensions: [],
            referenceTaskIds: [],
          }
        : undefined,
    },
    metadata: {},
  };
}

function artifactEvent(
  context: RequestContext,
  artifact: Artifact,
): TaskArtifactUpdateEvent {
  return {
    taskId: context.taskId,
    contextId: context.contextId,
    artifact,
    append: false,
    lastChunk: true,
    metadata: {},
  };
}

export class FinanceAgentExecutor implements AgentExecutor {
  constructor(private readonly gatewayFactory: () => McpGateway) {}

  async execute(
    context: RequestContext,
    eventBus: ExecutionEventBus,
  ): Promise<void> {
    eventBus.publish(AgentEvent.task(initialTask(context)));
    eventBus.publish(
      AgentEvent.statusUpdate(
        status(
          context,
          TaskState.TASK_STATE_WORKING,
          "Consultando ausencias grounded y calculando el escenario financiero.",
        ),
      ),
    );

    const dataPart = context.userMessage.parts.find(
      (part) => part.content?.$case === "data",
    );
    const payload = financeA2aPayloadSchema.parse(
      dataPart?.content?.$case === "data" ? dataPart.content.value : undefined,
    );
    const events: TraceEvent[] = [
      trace(payload.requestId, {
        category: "agent",
        name: "finance.request.validated",
        status: "completed",
        technology: "Zod + TypeScript",
        component: "AbsenceFinanceAgent",
        concepts: ["Agent", "Structured input", "Financial assumptions"],
        input: payload.input,
        output: { accepted: true },
      }),
    ];

    const gateway = this.gatewayFactory();
    try {
      let startedAt = performance.now();
      await gateway.connect();
      const tools = await gateway.listToolNames();
      if (!tools.includes("list_absences"))
        throw new Error("Required MCP tool is unavailable: list_absences");
      events.push(
        trace(payload.requestId, {
          category: "mcp",
          name: "finance.mcp.tool.discovered",
          status: "completed",
          technology: "Model Context Protocol",
          component: "list_absences",
          concepts: ["MCP Client", "Tool discovery", "Guardrail"],
          input: { requiredTool: "list_absences" },
          output: { available: true },
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        }),
      );

      startedAt = performance.now();
      const rawAbsences = await gateway.callTool("list_absences", {
        period: payload.input.period,
      });
      const absences = absencesOutputSchema.parse(rawAbsences);
      events.push(
        trace(payload.requestId, {
          category: "mcp",
          name: "finance.mcp.absences.completed",
          status: "completed",
          technology: "Model Context Protocol",
          component: "list_absences",
          concepts: ["MCP Tool", "Structured Output", "Grounding"],
          input: { period: payload.input.period },
          output: {
            source: absences.source,
            count: absences.count,
            total: absences.total,
          },
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        }),
      );
      events.push(
        trace(payload.requestId, {
          category: "database",
          name: "finance.database.source.read",
          status: "completed",
          technology: "PostgreSQL · Neon",
          component: "hr_absences",
          concepts: ["Source of Truth", "Fresh query"],
          output: {
            source: absences.source,
            queriedAt: absences.queriedAt,
            total: absences.total,
          },
        }),
      );

      startedAt = performance.now();
      const report = calculateAbsenceLossReport(absences, payload.input);
      events.push(
        trace(payload.requestId, {
          category: "agent",
          name: "finance.loss.calculated",
          status: "completed",
          technology: "Deterministic TypeScript calculator",
          component: "AbsenceLossCalculator",
          concepts: [
            "Deterministic workflow",
            "Guardrail",
            "Structured Output",
          ],
          input: report.assumptions,
          output: {
            absenceDays: report.absenceDays,
            affectedEmployees: report.affectedEmployees,
            totalEstimatedLoss: report.totals.totalEstimatedLoss,
          },
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        }),
      );

      const result = financeAgentResultSchema.parse({
        requestId: payload.requestId,
        taskId: context.taskId,
        contextId: context.contextId,
        agent: "Absence Finance Agent",
        report,
        trace: events,
      });
      const artifact: Artifact = {
        artifactId: randomUUID(),
        name: "absence-loss-report",
        description:
          "Informe grounded del impacto financiero de las ausencias.",
        parts: [
          {
            content: {
              $case: "text",
              value: `${report.absenceDays} día(s) de ausencia; impacto estimado ${report.assumptions.currency} ${report.totals.totalEstimatedLoss.toFixed(2)}.`,
            },
            metadata: undefined,
            filename: "",
            mediaType: "text/plain",
          },
          {
            content: { $case: "data", value: result },
            metadata: undefined,
            filename: "absence-loss-report.json",
            mediaType: "application/json",
          },
        ],
        metadata: { source: "postgresql", formula: report.assumptions.formula },
        extensions: [],
      };
      eventBus.publish(
        AgentEvent.artifactUpdate(artifactEvent(context, artifact)),
      );
      eventBus.publish(
        AgentEvent.statusUpdate(
          status(context, TaskState.TASK_STATE_COMPLETED),
        ),
      );
    } finally {
      await gateway.close();
    }
  }

  async cancelTask(): Promise<void> {
    throw new Error(
      "Cancellation is not supported for this short synchronous task",
    );
  }
}

export class HrAgentExecutor implements AgentExecutor {
  constructor(private readonly runnerFactory: () => AgentRunner) {}

  async execute(
    context: RequestContext,
    eventBus: ExecutionEventBus,
  ): Promise<void> {
    eventBus.publish(AgentEvent.task(initialTask(context)));
    eventBus.publish(
      AgentEvent.statusUpdate(
        status(
          context,
          TaskState.TASK_STATE_WORKING,
          "Ejecutando consulta grounded de RR. HH.",
        ),
      ),
    );
    const textPart = context.userMessage.parts.find(
      (part) => part.content?.$case === "text",
    );
    const question =
      textPart?.content?.$case === "text" ? textPart.content.value.trim() : "";
    if (!question) throw new Error("A text question is required");
    const requestId =
      typeof context.userMessage.metadata?.requestId === "string"
        ? context.userMessage.metadata.requestId
        : randomUUID();
    const answer = await this.runnerFactory().run(question, requestId);
    const artifact: Artifact = {
      artifactId: randomUUID(),
      name: "grounded-hr-answer",
      description: "Respuesta de RR. HH. grounded mediante MCP y PostgreSQL.",
      parts: [
        {
          content: { $case: "text", value: answer.answer },
          metadata: undefined,
          filename: "",
          mediaType: "text/plain",
        },
        {
          content: { $case: "data", value: answer },
          metadata: undefined,
          filename: "grounded-hr-answer.json",
          mediaType: "application/json",
        },
      ],
      metadata: { grounded: true, toolsUsed: answer.toolsUsed },
      extensions: [],
    };
    eventBus.publish(
      AgentEvent.artifactUpdate(artifactEvent(context, artifact)),
    );
    eventBus.publish(
      AgentEvent.statusUpdate(status(context, TaskState.TASK_STATE_COMPLETED)),
    );
  }

  async cancelTask(): Promise<void> {
    throw new Error(
      "Cancellation is not supported for this short synchronous task",
    );
  }
}
