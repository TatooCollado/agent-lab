import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { AgentRunner } from "../src/agent/orchestrator.js";
import type { AuthService } from "../src/auth/service.js";

const requestId = "22222222-2222-4222-8222-222222222222";
const viewer = { id: "11111111-1111-4111-8111-111111111111", username: "viewer", role: "viewer" as const };
const auth: AuthService = {
  login: vi.fn(),
  authenticate: vi.fn().mockResolvedValue(viewer),
  logout: vi.fn(),
  listUsers: vi.fn(),
  createUser: vi.fn(),
  clearHrData: vi.fn()
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
        trace: []
      })
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
      toolsUsed: ["find_employee"]
    });
    expect(agent.run).toHaveBeenCalledWith(
      "Buscá un empleado inexistente",
      requestId
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
