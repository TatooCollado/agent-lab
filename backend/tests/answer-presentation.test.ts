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
});
