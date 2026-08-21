import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { AgentRunner } from "../src/agent/orchestrator.js";
import { UnsupportedAgentQueryError } from "../src/agent/capability-router.js";
import { ProviderResilienceError } from "../src/resilience/provider-resilience.js";
import type { AuthService } from "../src/auth/service.js";

const requestId = "22222222-2222-4222-8222-222222222222";
const viewer = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "viewer",
  role: "viewer" as const,
};
const auth: AuthService = {
  login: vi.fn(),
  authenticate: vi.fn().mockResolvedValue(viewer),
  logout: vi.fn(),
  listUsers: vi.fn(),
  createUser: vi.fn(),
  clearHrData: vi.fn(),
};

describe("POST /api/agent/query", () => {
  it("validates the request and returns the grounded agent contract", async () => {
    const agent: AgentRunner = {
      run: vi.fn().mockResolvedValue({
        requestId,
        answer: "No se encontraron empleados.",
        model: "fake-model",
        grounded: true,
        toolsUsed: ["find_employee"],
        presentation: {
          kind: "employee_search",
          data: {
            source: "postgresql",
            queriedAt: "2026-08-20T12:00:00.000Z",
            count: 0,
            total: 0,
            truncated: false,
            query: "inexistente",
            records: [],
          },
        },
        trace: [],
      }),
    };

    const response = await request(createApp({ agent, auth }))
      .post("/api/agent/query")
      .set("cookie", "agent_lab_session=test-token")
      .set("x-request-id", requestId)
      .send({ question: "Buscá un empleado inexistente" });

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe(requestId);
    expect(response.body).toMatchObject({
      requestId,
      grounded: true,
      toolsUsed: ["find_employee"],
    });
    expect(agent.run).toHaveBeenCalledWith(
      "Buscá un empleado inexistente",
      requestId,
    );
  });

  it("rejects an invalid question before running the agent", async () => {
    const agent: AgentRunner = { run: vi.fn() };

    const response = await request(createApp({ agent, auth }))
      .post("/api/agent/query")
      .set("cookie", "agent_lab_session=test-token")
      .send({ question: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_agent_query");
    expect(agent.run).not.toHaveBeenCalled();
  });

  it("returns the supported capability catalog", async () => {
    const response = await request(
      createApp({ agent: { run: vi.fn() }, auth }),
    ).get("/api/agent/capabilities");

    expect(response.status).toBe(200);
    expect(response.body.capabilities).toHaveLength(7);
    expect(
      response.body.capabilities.map((item: { tool: string }) => item.tool),
    ).toEqual([
      "count_employees",
      "list_employees",
      "list_employees_without_late_arrivals",
      "summarize_employee_delays",
      "list_late_arrivals",
      "list_absences",
      "find_employee",
    ]);
  });

  it("returns a typed 422 response when the query is unsupported", async () => {
    const agent: AgentRunner = {
      run: vi
        .fn()
        .mockRejectedValue(
          new UnsupportedAgentQueryError([
            "employee_count",
            "employee_directory",
          ]),
        ),
    };

    const response = await request(createApp({ agent, auth }))
      .post("/api/agent/query")
      .set("cookie", "agent_lab_session=test-token")
      .send({ question: "¿Qué temperatura hace?" });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      error: "unsupported_agent_query",
      supportedCapabilities: expect.arrayContaining([
        "employee_count",
        "employee_directory",
      ]),
    });
  });

  it("maps provider resilience failures to a typed public error", async () => {
    const agent: AgentRunner = {
      run: vi
        .fn()
        .mockRejectedValue(
          new ProviderResilienceError("llm_timeout", 504, true),
        ),
    };

    const response = await request(createApp({ agent, auth }))
      .post("/api/agent/query")
      .set("cookie", "agent_lab_session=test-token")
      .send({ question: "¿Quién llegó tarde el último mes?" });

    expect(response.status).toBe(504);
    expect(response.body).toMatchObject({
      error: "llm_timeout",
      retryable: true,
    });
  });

  it("exposes the configured resilience contract without secrets", async () => {
    const agent: AgentRunner = {
      run: vi.fn(),
      resilienceSnapshot: () => ({
        circuit: { state: "closed", failures: 0 },
      }),
    };

    const response = await request(createApp({ agent, auth })).get(
      "/api/resilience",
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      policy: {
        timeoutMs: 12000,
        transientRetries: 1,
        circuitFailureThreshold: 3,
        finalizationFallback: "typed_answer_payload",
      },
      runtime: { circuit: { state: "closed", failures: 0 } },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /api.?key|token|password/i,
    );
  });

  it("requires an authenticated session", async () => {
    const agent: AgentRunner = { run: vi.fn() };
    const response = await request(createApp({ agent, auth }))
      .post("/api/agent/query")
      .send({ question: "Consultá las llegadas tarde" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("authentication_required");
    expect(agent.run).not.toHaveBeenCalled();
  });
});
