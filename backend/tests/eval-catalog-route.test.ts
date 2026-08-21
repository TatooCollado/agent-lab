import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { AuthService } from "../src/auth/service.js";

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

describe("GET /api/evals/catalog", () => {
  it("returns the technical evaluation contracts to an authenticated user", async () => {
    const response = await request(createApp({ auth }))
      .get("/api/evals/catalog")
      .set("cookie", "agent_lab_session=test-token");

    expect(response.status).toBe(200);
    expect(response.body.execution).toBe("npm run evals:run");
    expect(response.body.cases).toHaveLength(6);
    expect(response.body.cases[5]).toMatchObject({
      id: "source-of-truth-freshness",
      technique: "Dynamic fixture evaluation",
    });
  });

  it("requires authentication", async () => {
    const response = await request(createApp({ auth })).get(
      "/api/evals/catalog",
    );
    expect(response.status).toBe(401);
  });
});
