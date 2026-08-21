import { DateTime } from "luxon";
import { describe, expect, it, vi } from "vitest";
import type { HrRepository } from "../src/repositories/hr-repository.js";
import { HrToolService } from "../src/mcp/tool-service.js";

const timezone = "America/Argentina/Buenos_Aires";
const fixedNow = DateTime.fromISO("2026-08-15T14:30:00", {
  zone: timezone,
}).toJSDate();

function repository(): HrRepository {
  return {
    countEmployees: vi
      .fn()
      .mockResolvedValue({ total: 8, active: 7, inactive: 1 }),
    summarizeEmployeeDelays: vi.fn().mockResolvedValue({
      records: [
        {
          employeeId: "550e8400-e29b-41d4-a716-446655440000",
          employeeNumber: "EMP-002",
          fullName: "Bruno Silva",
          departmentCode: "OPS",
          occurrences: 2,
          totalLateMinutes: 57,
          averageLateMinutes: 29,
          maximumLateMinutes: 42,
          firstOccurrenceDate: "2026-06-10",
          lastOccurrenceDate: "2026-07-10",
        },
      ],
      total: 1,
      truncated: false,
    }),
    findEmployees: vi.fn().mockResolvedValue({
      records: [],
      total: 0,
      truncated: false,
    }),
    listLateArrivals: vi.fn().mockResolvedValue({
      records: [],
      total: 0,
      truncated: false,
    }),
    listAbsences: vi.fn().mockResolvedValue({
      records: [],
      total: 0,
      truncated: false,
    }),
  };
}

describe("HrToolService", () => {
  it("returns employee totals computed by PostgreSQL", async () => {
    const repo = repository();
    const service = new HrToolService(repo, timezone, () => fixedNow);

    await expect(service.countEmployees()).resolves.toMatchObject({
      source: "postgresql",
      count: 8,
      total: 8,
      active: 7,
      inactive: 1,
      truncated: false,
    });
  });

  it("returns an explicit empty collection for a search without matches", async () => {
    const repo = repository();
    const service = new HrToolService(repo, timezone, () => fixedNow);

    const output = await service.findEmployee({ query: "EMP-NOT-FOUND" });

    expect(output).toMatchObject({
      source: "postgresql",
      query: "EMP-NOT-FOUND",
      count: 0,
      total: 0,
      truncated: false,
      records: [],
    });
  });

  it("returns a grounded aggregate of an employee's historical delays", async () => {
    const repo = repository();
    const service = new HrToolService(repo, timezone, () => fixedNow);

    await expect(
      service.summarizeEmployeeDelays({ query: "Bruno Silva" }),
    ).resolves.toMatchObject({
      source: "postgresql",
      query: "Bruno Silva",
      count: 1,
      total: 1,
      records: [
        {
          employeeNumber: "EMP-002",
          totalLateMinutes: 57,
          occurrences: 2,
        },
      ],
    });
    expect(repo.summarizeEmployeeDelays).toHaveBeenCalledWith("Bruno Silva");
  });

  it("passes the complete previous calendar month to the repository", async () => {
    const repo = repository();
    const service = new HrToolService(repo, timezone, () => fixedNow);

    const output = await service.listLateArrivals({
      period: "previous_calendar_month",
    });

    expect(repo.listLateArrivals).toHaveBeenCalledWith(
      {
        name: "previous_calendar_month",
        timezone,
        startInclusive: "2026-07-01T00:00:00-03:00",
        endExclusive: "2026-08-01T00:00:00-03:00",
      },
      undefined,
    );
    expect(output.count).toBe(0);
  });

  it("queries the repository on every invocation instead of caching", async () => {
    const repo = repository();
    const service = new HrToolService(repo, timezone, () => fixedNow);

    await service.listAbsences({ period: "current_month" });
    await service.listAbsences({ period: "current_month" });

    expect(repo.listAbsences).toHaveBeenCalledTimes(2);
  });
});
