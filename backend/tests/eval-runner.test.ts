import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { AgentAnswer } from "../src/agent/contracts.js";
import type { AgentRunner } from "../src/agent/orchestrator.js";
import type { FreshnessFixture, EvalFixtureManager } from "../src/evals/fixture-manager.js";
import { runAgentEvals } from "../src/evals/runner.js";

const fixture: FreshnessFixture = {
  employeeId: "11111111-1111-4111-8111-111111111111",
  employeeNumber: "EVAL-ABC12345"
};

function answer(tool: string, count: number, records: unknown[], text: string): AgentAnswer {
  const requestId = randomUUID();
  return {
    requestId,
    answer: text,
    model: "deterministic-fake-model",
    grounded: true,
    toolsUsed: [tool],
    trace: [{
      id: randomUUID(),
      requestId,
      timestamp: new Date().toISOString(),
      category: "mcp",
      name: "mcp.tool.call.completed",
      status: "completed",
      technology: "Model Context Protocol",
      component: tool,
      concepts: ["Grounding"],
      output: { count, records }
    }]
  };
}

function fixtureManager(): EvalFixtureManager {
  return {
    createFreshnessFixture: vi.fn().mockResolvedValue(fixture),
    cleanupFreshnessFixture: vi.fn().mockResolvedValue(undefined)
  };
}

describe("runAgentEvals", () => {
  it("scores grounded, negative and dynamic freshness behavior", async () => {
    const agent: AgentRunner = {
      run: vi.fn().mockImplementation((prompt: string) => {
        if (prompt.includes("EMP-NOT-FOUND")) {
          return answer("find_employee", 0, [], "No se encontraron empleados.");
        }
        if (prompt.includes(fixture.employeeNumber)) {
          return answer("list_late_arrivals", 1, [{ employeeNumber: fixture.employeeNumber }], "Se encontró una llegada tarde.");
        }
        return answer("list_late_arrivals", 2, [{}, {}], "Se encontraron dos llegadas tarde.");
      })
    };
    const fixtures = fixtureManager();

    const result = await runAgentEvals(agent, fixtures);

    expect(result).toMatchObject({ passed: 3, failed: 0, total: 3, passRate: 1 });
    expect(result.results.map((item) => item.score)).toEqual([1, 1, 1]);
    expect(fixtures.cleanupFreshnessFixture).toHaveBeenCalledWith(fixture);
  });

  it("records an agent error as a failed case and still cleans the dynamic fixture", async () => {
    const agent: AgentRunner = {
      run: vi.fn().mockImplementation((prompt: string) => {
        if (prompt.includes(fixture.employeeNumber)) throw new Error("simulated model failure");
        if (prompt.includes("EMP-NOT-FOUND")) return answer("find_employee", 0, [], "No hay resultados.");
        return answer("list_late_arrivals", 2, [], "Dos llegadas tarde.");
      })
    };
    const fixtures = fixtureManager();

    const result = await runAgentEvals(agent, fixtures);

    expect(result.failed).toBe(1);
    expect(result.results[2]).toMatchObject({ caseId: "source-of-truth-freshness", passed: false, score: 0 });
    expect(fixtures.cleanupFreshnessFixture).toHaveBeenCalledWith(fixture);
  });
});
