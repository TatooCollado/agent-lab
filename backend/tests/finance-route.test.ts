import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { AuthService } from "../src/auth/service.js";
import type { FinanceCoordinator } from "../src/a2a/finance-client.js";

const viewer = { id: "11111111-1111-4111-8111-111111111111", username: "viewer", role: "viewer" as const };
const auth: AuthService = {
  login: vi.fn(),
  authenticate: vi.fn().mockResolvedValue(viewer),
  logout: vi.fn(),
  listUsers: vi.fn(),
  createUser: vi.fn(),
  clearHrData: vi.fn()
};

describe("POST /api/finance/absence-loss-report", () => {
  it("delegates a validated scenario to the finance coordinator", async () => {
    const run = vi.fn().mockResolvedValue({ requestId: "22222222-2222-4222-8222-222222222222" });
    const financeCoordinator: FinanceCoordinator = { run };
    const response = await request(createApp({ auth, financeCoordinator }))
      .post("/api/finance/absence-loss-report")
      .set("x-request-id", "22222222-2222-4222-8222-222222222222")
      .set("cookie", "agent_lab_session=test-token")
      .send({
        period: "previous_calendar_month",
        currency: "ars",
        dailyCost: 100000,
        replacementPremiumRate: 0.35,
        productivityLossRate: 0.2
      });

    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ currency: "ARS" }), "22222222-2222-4222-8222-222222222222");
  });

  it("rejects missing financial assumptions", async () => {
    const run = vi.fn();
    const response = await request(createApp({ auth, financeCoordinator: { run } }))
      .post("/api/finance/absence-loss-report")
      .set("cookie", "agent_lab_session=test-token")
      .send({ period: "previous_calendar_month", currency: "ARS" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_finance_report");
    expect(run).not.toHaveBeenCalled();
  });
});
