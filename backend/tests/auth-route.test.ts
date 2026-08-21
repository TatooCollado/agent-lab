import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { AuthService } from "../src/auth/service.js";

const admin = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "admin",
  role: "admin" as const
};
const viewer = {
  id: "22222222-2222-4222-8222-222222222222",
  username: "viewer",
  role: "viewer" as const
};

function authService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    login: vi.fn().mockResolvedValue(null),
    authenticate: vi.fn().mockResolvedValue(null),
    logout: vi.fn(),
    listUsers: vi.fn().mockResolvedValue([]),
    createUser: vi.fn(),
    clearHrData: vi.fn(),
    ...overrides
  };
}

describe("authentication and RBAC routes", () => {
  it("creates an opaque HttpOnly session cookie on login", async () => {
    const expiresAt = new Date("2026-08-21T12:00:00.000Z");
    const auth = authService({
      login: vi.fn().mockResolvedValue({ token: "opaque-token", user: viewer, expiresAt })
    });
    const response = await request(createApp({ auth }))
      .post("/api/auth/login")
      .send({ username: "viewer", password: "valid-password-123" });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual(viewer);
    const cookie = response.headers["set-cookie"]?.[0];
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
  });

  it("rejects a viewer from admin endpoints", async () => {
    const auth = authService({ authenticate: vi.fn().mockResolvedValue(viewer) });
    const response = await request(createApp({ auth }))
      .get("/api/admin/users")
      .set("cookie", "agent_lab_session=viewer-token");

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("admin_required");
  });

  it("lets an admin create a user", async () => {
    const created = { ...viewer, username: "auditor", active: true, createdAt: "2026-08-20T12:00:00.000Z" };
    const createUser = vi.fn().mockResolvedValue(created);
    const auth = authService({
      authenticate: vi.fn().mockResolvedValue(admin),
      createUser
    });
    const response = await request(createApp({ auth }))
      .post("/api/admin/users")
      .set("cookie", "agent_lab_session=admin-token")
      .send({ username: "auditor", password: "valid-password-123", role: "viewer" });

    expect(response.status).toBe(201);
    expect(response.body.user.username).toBe("auditor");
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ actor: admin, role: "viewer" }));
  });

  it("requires an exact confirmation before clearing HR data", async () => {
    const clearHrData = vi.fn();
    const auth = authService({
      authenticate: vi.fn().mockResolvedValue(admin),
      clearHrData
    });
    const response = await request(createApp({ auth }))
      .delete("/api/admin/hr-data")
      .set("cookie", "agent_lab_session=admin-token")
      .send({ confirmation: "delete" });

    expect(response.status).toBe(400);
    expect(clearHrData).not.toHaveBeenCalled();
  });
});
