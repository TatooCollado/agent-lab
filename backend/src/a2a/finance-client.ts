import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { Role, TaskState, type AgentCard, type SendMessageRequest, type Task } from "@a2a-js/sdk";
import {
  ClientFactory,
  ClientFactoryOptions,
  DefaultAgentCardResolver,
  JsonRpcTransportFactory
} from "@a2a-js/sdk/client";
import type { TraceEvent } from "../observability/trace-event.js";
import {
  financeAgentResultSchema,
  financeWorkflowResultSchema,
  type FinanceReportInput,
  type FinanceWorkflowResult
} from "../finance/contracts.js";

export interface FinanceCoordinator {
  run(input: FinanceReportInput, requestId: string): Promise<FinanceWorkflowResult>;
}

function event(
  requestId: string,
  value: Omit<TraceEvent, "id" | "requestId" | "timestamp">
): TraceEvent {
  return { id: randomUUID(), requestId, timestamp: new Date().toISOString(), ...value };
}

function authenticatedFetch(token: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };
}

function asTask(result: unknown): Task {
  if (typeof result !== "object" || result === null || !("artifacts" in result)) {
    throw new Error("Finance agent returned a message instead of a completed task");
  }
  return result as Task;
}

export class A2aFinanceCoordinator implements FinanceCoordinator {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {}

  async run(input: FinanceReportInput, requestId: string): Promise<FinanceWorkflowResult> {
    const trace: TraceEvent[] = [];
    const fetchImpl = authenticatedFetch(this.token);
    const factory = new ClientFactory(
      ClientFactoryOptions.createFrom(ClientFactoryOptions.default, {
        cardResolver: new DefaultAgentCardResolver({ fetchImpl }),
        transports: [new JsonRpcTransportFactory({ fetchImpl })],
        preferredTransports: ["JSONRPC"]
      })
    );

    let startedAt = performance.now();
    const client = await factory.createFromUrl(
      this.baseUrl,
      "/.well-known/finance-agent-card.json"
    );
    const card: AgentCard = await client.getAgentCard();
    trace.push(event(requestId, {
      category: "a2a",
      name: "a2a.agent_card.discovered",
      status: "completed",
      technology: "A2A Protocol 1.0",
      component: "A2A Client",
      concepts: ["A2A Client", "Agent discovery", "Agent Card"],
      input: { path: "/.well-known/finance-agent-card.json" },
      output: { name: card.name, skills: card.skills.map((skill) => skill.id), interfaces: card.supportedInterfaces.map((item) => item.protocolBinding) },
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100
    }));

    const request: SendMessageRequest = {
      tenant: "",
      message: {
        messageId: randomUUID(),
        contextId: "",
        taskId: "",
        role: Role.ROLE_USER,
        parts: [{
          content: { $case: "data", value: { requestId, input } },
          metadata: { skill: "absence_loss_report" },
          filename: "absence-loss-request.json",
          mediaType: "application/json"
        }],
        metadata: { requestId, delegatedBy: "HR Grounding Agent" },
        extensions: [],
        referenceTaskIds: []
      },
      configuration: {
        acceptedOutputModes: ["text/plain", "application/json"],
        taskPushNotificationConfig: undefined,
        returnImmediately: false
      },
      metadata: { requestId }
    };

    startedAt = performance.now();
    const task = asTask(await client.sendMessage(request));
    if (task.status?.state !== TaskState.TASK_STATE_COMPLETED) {
      throw new Error(`Finance A2A task did not complete: ${String(task.status?.state)}`);
    }
    trace.push(event(requestId, {
      category: "a2a",
      name: "a2a.send_message.completed",
      status: "completed",
      technology: "A2A · JSON-RPC 2.0",
      component: "SendMessage",
      concepts: ["Agent delegation", "Message", "Task lifecycle"],
      input: { skill: "absence_loss_report", acceptedOutputModes: ["text/plain", "application/json"] },
      output: { taskId: task.id, contextId: task.contextId, state: "TASK_STATE_COMPLETED" },
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100
    }));

    const artifact = task.artifacts.find((item) => item.name === "absence-loss-report");
    const dataPart = artifact?.parts.find((part) => part.content?.$case === "data");
    const remote = financeAgentResultSchema.parse(
      dataPart?.content?.$case === "data" ? dataPart.content.value : undefined
    );
    trace.push(...remote.trace);
    trace.push(event(requestId, {
      category: "a2a",
      name: "a2a.artifact.received",
      status: "completed",
      technology: "A2A Protocol 1.0",
      component: artifact?.name ?? "absence-loss-report",
      concepts: ["Artifact", "Structured data", "Agent collaboration"],
      input: { taskId: task.id },
      output: { mediaTypes: artifact?.parts.map((part) => part.mediaType), reportId: remote.report.reportId }
    }));

    return financeWorkflowResultSchema.parse({
      requestId,
      delegation: {
        clientAgent: "HR Grounding Agent",
        remoteAgent: card.name,
        protocol: "A2A",
        protocolVersion: card.supportedInterfaces[0]?.protocolVersion ?? "1.0",
        transport: "JSONRPC",
        taskId: task.id,
        contextId: task.contextId,
        artifactName: artifact?.name ?? "absence-loss-report"
      },
      report: remote.report,
      trace
    });
  }
}
