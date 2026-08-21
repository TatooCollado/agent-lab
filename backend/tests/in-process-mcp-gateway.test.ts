import { describe, expect, it } from "vitest";
import { InProcessMcpGateway } from "../src/agent/mcp-gateway.js";
import type { HrRepository } from "../src/repositories/hr-repository.js";

describe("InProcessMcpGateway", () => {
  it("connects an MCP client and server without spawning a child process", async () => {
    const repository: HrRepository = {
      async countEmployees() {
        return { total: 8, active: 7, inactive: 1 };
      },
      async listEmployees() {
        return { records: [], total: 0, truncated: false };
      },
      async summarizeEmployeeDelays() {
        return { records: [], total: 0, truncated: false };
      },
      async findEmployees() {
        return { records: [], total: 0, truncated: false };
      },
      async listLateArrivals() {
        return {
          records: [
            {
              employeeId: "550e8400-e29b-41d4-a716-446655440000",
              employeeNumber: "EMP-001",
              fullName: "Ada Test",
              departmentCode: "ENG",
              workDate: "2026-08-20",
              scheduledStart: "2026-08-20T09:00:00.000Z",
              actualArrival: "2026-08-20T09:12:00.000Z",
              lateMinutes: 12,
            },
          ],
          total: 1,
          truncated: false,
        };
      },
      async listAbsences() {
        return { records: [], total: 0, truncated: false };
      },
    };
    const gateway = new InProcessMcpGateway(
      repository,
      "America/Argentina/Buenos_Aires",
    );

    try {
      await gateway.connect();
      await expect(gateway.listToolNames()).resolves.toEqual([
        "count_employees",
        "list_employees",
        "find_employee",
        "summarize_employee_delays",
        "list_late_arrivals",
        "list_absences",
      ]);
      await expect(
        gateway.callTool("count_employees", {}),
      ).resolves.toMatchObject({
        source: "postgresql",
        count: 8,
        active: 7,
        inactive: 1,
      });
      await expect(
        gateway.callTool("list_late_arrivals", { period: "current_month" }),
      ).resolves.toMatchObject({ source: "postgresql", count: 1, total: 1 });
    } finally {
      await gateway.close();
    }
  });
});
