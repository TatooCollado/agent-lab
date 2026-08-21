import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { AuthService } from "../src/auth/service.js";
import type { DataExplorerService } from "../src/data-explorer/service.js";

const viewer = { id: "11111111-1111-4111-8111-111111111111", username: "viewer", role: "viewer" as const };
const admin = { id: "22222222-2222-4222-8222-222222222222", username: "admin", role: "admin" as const };

function auth(user: typeof viewer | typeof admin): AuthService {
  return {
    login: vi.fn(), authenticate: vi.fn().mockResolvedValue(user), logout: vi.fn(),
    listUsers: vi.fn(), createUser: vi.fn(), clearHrData: vi.fn(),
  };
}

function explorer(overrides: Partial<DataExplorerService> = {}): DataExplorerService {
  return {
    snapshot: vi.fn().mockResolvedValue({ departments: [], employees: [], attendanceRecords: [], policy: { exposedResources: ["departments", "employees", "attendance_records"], hiddenResources: ["app_users", "app_sessions", "audit_events"], freeFormSql: false, attendanceLimit: 200 } }),
    createDepartment: vi.fn(), updateDepartment: vi.fn(), deleteDepartment: vi.fn(),
    createEmployee: vi.fn(), updateEmployee: vi.fn(), deleteEmployee: vi.fn(),
    createAttendance: vi.fn(), updateAttendance: vi.fn(), deleteAttendance: vi.fn(),
    ...overrides,
  };
}

describe("data explorer routes", () => {
  it("allows a viewer to read only the curated snapshot", async () => {
    const dataExplorer = explorer();
    const response = await request(createApp({ auth: auth(viewer), dataExplorer }))
      .get("/api/data-explorer/snapshot")
      .set("cookie", "agent_lab_session=viewer-token");

    expect(response.status).toBe(200);
    expect(response.body.policy.freeFormSql).toBe(false);
    expect(response.body.policy.hiddenResources).toContain("app_sessions");
  });

  it("rejects CRUD operations for a viewer", async () => {
    const createDepartment = vi.fn();
    const response = await request(createApp({ auth: auth(viewer), dataExplorer: explorer({ createDepartment }) }))
      .post("/api/data-explorer/departments")
      .set("cookie", "agent_lab_session=viewer-token")
      .send({ code: "OPS", name: "Operaciones" });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("admin_required");
    expect(createDepartment).not.toHaveBeenCalled();
  });

  it("validates and delegates an admin mutation with its audit actor", async () => {
    const created = { id: "33333333-3333-4333-8333-333333333333", code: "OPS", name: "Operaciones", createdAt: "2026-08-21T12:00:00.000Z" };
    const createDepartment = vi.fn().mockResolvedValue(created);
    const response = await request(createApp({ auth: auth(admin), dataExplorer: explorer({ createDepartment }) }))
      .post("/api/data-explorer/departments")
      .set("cookie", "agent_lab_session=admin-token")
      .send({ code: "ops", name: "Operaciones" });

    expect(response.status).toBe(201);
    expect(response.body.department.code).toBe("OPS");
    expect(createDepartment).toHaveBeenCalledWith({ code: "OPS", name: "Operaciones" }, admin);
  });

  it("rejects inconsistent attendance before touching PostgreSQL", async () => {
    const createAttendance = vi.fn();
    const response = await request(createApp({ auth: auth(admin), dataExplorer: explorer({ createAttendance }) }))
      .post("/api/data-explorer/attendance")
      .set("cookie", "agent_lab_session=admin-token")
      .send({ employeeId: admin.id, workDate: "2026-08-21", scheduledStart: "2026-08-21T09:00:00-03:00", actualArrival: null, status: "present", absenceReason: null, source: "manual-demo" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_resource");
    expect(createAttendance).not.toHaveBeenCalled();
  });
});
