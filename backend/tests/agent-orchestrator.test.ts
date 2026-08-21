import { describe, expect, it, vi } from "vitest";
import type {
  AgentLlm,
  AgentPlan,
  AgentToolDefinition,
  AgentToolOutput,
} from "../src/agent/contracts.js";
import type { McpGateway } from "../src/agent/mcp-gateway.js";
import { HrAgentOrchestrator } from "../src/agent/orchestrator.js";
import { ProviderResilienceError } from "../src/resilience/provider-resilience.js";

const requestId = "11111111-1111-4111-8111-111111111111";

class FakeGateway implements McpGateway {
  connected = false;
  closed = false;
  calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

  async connect() {
    this.connected = true;
  }

  async listToolNames() {
    return [
      "count_employees",
      "list_employees",
      "find_employee",
      "summarize_employee_delays",
      "list_late_arrivals",
      "list_employees_without_late_arrivals",
      "list_absences",
    ];
  }

  async callTool(name: string, arguments_: Record<string, unknown>) {
    this.calls.push({ name, arguments: arguments_ });
    const base = {
      source: "postgresql",
      queriedAt: "2026-08-20T12:00:00.000Z",
      count: 0,
      total: 0,
      truncated: false,
    };
    if (name === "find_employee") {
      return { ...base, query: String(arguments_.query), records: [] };
    }
    if (name === "list_late_arrivals") {
      return {
        ...base,
        employeeNumber: null,
        period: {
          name: "previous_calendar_month",
          timezone: "America/Argentina/Buenos_Aires",
          startInclusive: "2026-07-01T00:00:00-03:00",
          endExclusive: "2026-08-01T00:00:00-03:00",
        },
        records: [],
      };
    }
    if (name === "list_employees_without_late_arrivals") {
      return {
        ...base,
        period: {
          name: "previous_calendar_month",
          timezone: "America/Argentina/Buenos_Aires",
          startInclusive: "2026-07-01T00:00:00-03:00",
          endExclusive: "2026-08-01T00:00:00-03:00",
        },
        records: [],
      };
    }
    return { ...base, records: [] };
  }

  async close() {
    this.closed = true;
  }
}

class FakeLlm implements AgentLlm {
  planInput?: {
    question: string;
    instructions: string;
    tools: AgentToolDefinition[];
  };
  responseOutputs?: AgentToolOutput[];

  async plan(input: {
    question: string;
    instructions: string;
    tools: AgentToolDefinition[];
  }): Promise<AgentPlan> {
    this.planInput = input;
    const selectedName = input.question.includes("temperatura")
      ? "reject_unsupported_query"
      : input.question.includes("no llegó tarde")
        ? "list_employees_without_late_arrivals"
        : input.question.includes("llegó tarde")
          ? "list_late_arrivals"
          : "find_employee";
    const selected = input.tools.find((tool) => tool.name === selectedName)!;
    return {
      model: "fake-model",
      calls: [
        {
          callId: "call-1",
          name: selected.name,
          arguments:
            selected.name === "reject_unsupported_query"
              ? { reason: "unsupported_capability", candidateCapability: null }
              : selected.name === "find_employee"
                ? { query: "Inexistente" }
                : selected.name === "list_late_arrivals"
                  ? { period: "previous_calendar_month", employeeNumber: null }
                  : selected.name === "list_employees_without_late_arrivals"
                    ? { period: "previous_calendar_month" }
                    : {},
        },
      ],
      continuation: [],
    };
  }

  async respond(input: { toolOutputs: AgentToolOutput[] }) {
    this.responseOutputs = input.toolOutputs;
    const count = input.toolOutputs[0]?.output.count;
    return {
      answer:
        count === 0
          ? "No se encontraron empleados para la búsqueda indicada."
          : "Se encontraron empleados.",
      model: "fake-model",
    };
  }
}

describe("HrAgentOrchestrator", () => {
  it("grounds a zero-result answer through a real MCP-shaped tool output", async () => {
    const llm = new FakeLlm();
    const gateway = new FakeGateway();
    const agent = new HrAgentOrchestrator(llm, () => gateway);

    const result = await agent.run("Buscá al empleado Inexistente", requestId);

    expect(gateway.calls).toEqual([
      { name: "find_employee", arguments: { query: "Inexistente" } },
    ]);
    expect(llm.responseOutputs?.[0]?.output).toMatchObject({
      source: "postgresql",
      count: 0,
      records: [],
    });
    expect(result.answer).toMatch(/no se encontraron/i);
    expect(result.grounded).toBe(true);
    expect(result.toolsUsed).toEqual(["find_employee"]);
    expect(result.trace.map((item) => item.name)).toEqual([
      "agent.request.validated",
      "mcp.tools.discovered",
      "agent.tools.allowlist.validated",
      "llm.semantic_proposal.completed",
      "agent.semantic_decision.validated",
      "mcp.tool.call.completed",
      "database.source.read",
      "grounding.context.assembled",
      "llm.grounded_response.completed",
      "presentation.payload.validated",
    ]);
    expect(
      result.trace.find(
        (item) => item.name === "llm.grounded_response.completed",
      )?.output,
    ).toMatchObject({ recovery: "not_required" });
    expect(gateway.closed).toBe(true);
  });

  it("provides only strict controlled tools and a source-of-truth prompt", async () => {
    const llm = new FakeLlm();
    const agent = new HrAgentOrchestrator(llm, () => new FakeGateway());

    await agent.run("¿Quién llegó tarde el mes pasado?", requestId);

    expect(llm.planInput?.tools).toHaveLength(9);
    expect(llm.planInput?.tools.map((tool) => tool.name)).toContain(
      "list_late_arrivals",
    );
    expect(llm.planInput?.tools.map((tool) => tool.name)).toContain(
      "request_clarification",
    );
    expect(llm.planInput?.tools.every((tool) => tool.strict)).toBe(true);
    expect(llm.planInput?.instructions).toMatch(/exclusivamente/i);
    expect(llm.planInput?.instructions).toMatch(/count igual a 0/i);
  });

  it("rejects an unapproved tool before MCP execution", async () => {
    const gateway = new FakeGateway();
    const llm: AgentLlm = {
      plan: vi.fn().mockResolvedValue({
        model: "fake-model",
        calls: [{ callId: "call-1", name: "run_sql", arguments: {} }],
        continuation: [],
      }),
      respond: vi.fn(),
    };
    const agent = new HrAgentOrchestrator(llm, () => gateway);

    await expect(
      agent.run("Buscá al empleado EMP-001", requestId),
    ).rejects.toThrow(/unapproved tool/i);
    expect(gateway.calls).toHaveLength(0);
    expect(gateway.closed).toBe(true);
  });

  it("preserves the typed payload when final LLM narration is unavailable", async () => {
    const gateway = new FakeGateway();
    const llm = new FakeLlm();
    llm.respond = vi
      .fn()
      .mockRejectedValue(
        new ProviderResilienceError("llm_provider_unavailable", 503, true),
      );
    const agent = new HrAgentOrchestrator(llm, () => gateway);

    const result = await agent.run("Buscá al empleado Inexistente", requestId);

    expect(result.grounded).toBe(true);
    expect(result.presentation.kind).toBe("employee_search");
    expect(result.answer).toMatch(/narrativa del modelo no está disponible/i);
    expect(result.trace.map((item) => item.name)).toContain(
      "llm.grounded_response.degraded",
    );
    expect(
      result.trace.find(
        (item) => item.name === "llm.grounded_response.degraded",
      )?.output,
    ).toMatchObject({
      recovery: "safe_degradation:llm_provider_unavailable",
    });
  });

  it("routes an explicit negation to the SQL set-complement tool", async () => {
    const llm = new FakeLlm();
    const gateway = new FakeGateway();
    const agent = new HrAgentOrchestrator(llm, () => gateway);

    const result = await agent.run(
      "¿Quién no llegó tarde el último mes?",
      requestId,
    );

    expect(gateway.calls).toEqual([
      {
        name: "list_employees_without_late_arrivals",
        arguments: { period: "previous_calendar_month" },
      },
    ]);
    expect(result.presentation.kind).toBe("employees_without_late_arrivals");
  });

  it("rejects a query outside the declared capability matrix", async () => {
    const gateway = new FakeGateway();
    const llm = new FakeLlm();
    const agent = new HrAgentOrchestrator(llm, () => gateway);

    await expect(
      agent.run("¿Qué temperatura hace en Córdoba?", requestId),
    ).rejects.toThrow(/supported agent capability/i);
    expect(llm.planInput?.tools.map((tool) => tool.name)).toContain(
      "reject_unsupported_query",
    );
    expect(gateway.calls).toHaveLength(0);
    expect(gateway.closed).toBe(true);
  });
});
