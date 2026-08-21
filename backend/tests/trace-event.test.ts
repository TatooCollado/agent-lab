import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { traceEventSchema } from "../src/observability/trace-event.js";

describe("traceEventSchema", () => {
  it("accepts a technical database event", () => {
    const parsed = traceEventSchema.parse({
      id: randomUUID(),
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
      category: "database",
      name: "postgres.query.completed",
      status: "completed",
      technology: "PostgreSQL",
      component: "AttendanceRepository",
      concepts: ["Source of Truth", "Parameterized SQL"],
      input: { statement: "SELECT ... WHERE occurred_at >= $1", parameters: ["2026-07-01"] },
      output: { rowCount: 3 },
      durationMs: 18
    });

    expect(parsed.category).toBe("database");
  });

  it("rejects unrecognized categories", () => {
    expect(() => traceEventSchema.parse({
      id: randomUUID(),
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
      category: "internal-thought",
      name: "hidden",
      status: "completed",
      technology: "Unknown",
      component: "Unknown",
      concepts: []
    })).toThrow();
  });
});
