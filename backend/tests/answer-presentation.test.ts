import { describe, expect, it } from "vitest";
import { createAnswerPresentation } from "../src/agent/answer-presentation.js";

describe("createAnswerPresentation", () => {
  it("validates and discriminates an employee count payload", () => {
    const presentation = createAnswerPresentation({
      callId: "call-1",
      name: "count_employees",
      output: {
        source: "postgresql",
        queriedAt: "2026-08-20T12:00:00.000Z",
        count: 3,
        total: 3,
        truncated: false,
        active: 3,
        inactive: 0,
      },
    });

    expect(presentation).toMatchObject({
      kind: "employee_count",
      data: { total: 3, active: 3, inactive: 0 },
    });
  });

  it("rejects malformed tool data before it reaches React", () => {
    expect(() =>
      createAnswerPresentation({
        callId: "call-1",
        name: "count_employees",
        output: { source: "postgresql", total: "three" },
      }),
    ).toThrow();
  });

  it("validates the explicit complement payload", () => {
    const presentation = createAnswerPresentation({
      callId: "call-2",
      name: "list_employees_without_late_arrivals",
      output: {
        source: "postgresql",
        queriedAt: "2026-08-20T12:00:00.000Z",
        count: 1,
        total: 1,
        truncated: false,
        period: {
          name: "previous_calendar_month",
          timezone: "America/Argentina/Buenos_Aires",
          startInclusive: "2026-07-01T00:00:00-03:00",
          endExclusive: "2026-08-01T00:00:00-03:00",
        },
        records: [
          {
            employeeId: "550e8400-e29b-41d4-a716-446655440003",
            employeeNumber: "EMP-003",
            fullName: "Carla Méndez",
            departmentCode: "FIN",
            departmentName: "Finance",
            timezone: "America/Argentina/Buenos_Aires",
            active: true,
          },
        ],
      },
    });

    expect(presentation).toMatchObject({
      kind: "employees_without_late_arrivals",
      data: { count: 1, records: [{ employeeNumber: "EMP-003" }] },
    });
  });
});
