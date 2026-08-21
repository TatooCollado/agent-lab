import { describe, expect, it } from "vitest";
import { calculateAbsenceLossReport } from "../src/finance/calculator.js";
import type { AbsencesOutput } from "../src/mcp/contracts.js";

const absences: AbsencesOutput = {
  source: "postgresql",
  queriedAt: "2026-08-20T12:00:00.000Z",
  count: 2,
  total: 2,
  truncated: false,
  employeeNumber: null,
  period: {
    name: "previous_calendar_month",
    timezone: "America/Argentina/Buenos_Aires",
    startInclusive: "2026-07-01T00:00:00-03:00",
    endExclusive: "2026-08-01T00:00:00-03:00"
  },
  records: [
    { employeeId: "11111111-1111-4111-8111-111111111111", employeeNumber: "EMP-001", fullName: "Ana Torres", departmentCode: "ENG", workDate: "2026-07-03", scheduledStart: "2026-07-03T12:00:00.000Z", absenceReason: "illness" },
    { employeeId: "11111111-1111-4111-8111-111111111111", employeeNumber: "EMP-001", fullName: "Ana Torres", departmentCode: "ENG", workDate: "2026-07-04", scheduledStart: "2026-07-04T12:00:00.000Z", absenceReason: "illness" }
  ]
};

describe("calculateAbsenceLossReport", () => {
  it("applies explicit assumptions without asking an LLM to perform arithmetic", () => {
    const report = calculateAbsenceLossReport(absences, {
      period: "previous_calendar_month",
      currency: "ARS",
      dailyCost: 100,
      replacementPremiumRate: 0.5,
      productivityLossRate: 0.25
    }, new Date("2026-08-20T12:00:00.000Z"));

    expect(report).toMatchObject({
      source: "postgresql",
      absenceDays: 2,
      affectedEmployees: 1,
      totals: {
        paidAbsenceCost: 200,
        replacementPremiumCost: 100,
        productivityLossCost: 50,
        totalEstimatedLoss: 350
      }
    });
  });

  it("returns zero totals for an empty grounded result", () => {
    const report = calculateAbsenceLossReport({ ...absences, count: 0, total: 0, records: [] }, {
      period: "previous_calendar_month",
      currency: "ARS",
      dailyCost: 100,
      replacementPremiumRate: 0.5,
      productivityLossRate: 0.25
    });
    expect(report.totals.totalEstimatedLoss).toBe(0);
    expect(report.breakdown).toEqual([]);
  });

  it("refuses to price an incomplete result set", () => {
    expect(() => calculateAbsenceLossReport({ ...absences, truncated: true, total: 101 }, {
      period: "previous_calendar_month",
      currency: "ARS",
      dailyCost: 100,
      replacementPremiumRate: 0.5,
      productivityLossRate: 0.25
    })).toThrow(/truncated absence records/i);
  });
});
