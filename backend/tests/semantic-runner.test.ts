import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type {
  AgentLlm,
  AgentPlan,
  AgentToolDefinition,
} from "../src/agent/contracts.js";
import {
  SEMANTIC_BENCHMARK,
  type SemanticBenchmarkCase,
} from "../src/evals/semantic-benchmark.js";
import { runSemanticBenchmark } from "../src/evals/semantic-runner.js";

const cases: SemanticBenchmarkCase[] = [
  {
    id: "late-colloquial",
    capability: "late_arrivals",
    variant: "rioplatense",
    question: "¿Quién cayó tarde este mes?",
    expected: {
      kind: "execute",
      tool: "list_late_arrivals",
      arguments: { period: "current_month", employeeNumber: null },
    },
  },
  {
    id: "late-missing-period",
    capability: "late_arrivals",
    variant: "missing-period",
    question: "¿Quién fichó tarde?",
    expected: { kind: "clarification", reason: "missing_period" },
  },
];

class StableSemanticLlm implements AgentLlm {
  async plan(input: {
    question: string;
    instructions: string;
    tools: AgentToolDefinition[];
  }): Promise<AgentPlan> {
    const missing = !input.question.includes("este mes");
    return {
      model: "fake-semantic-model",
      calls: [
        missing
          ? {
              callId: "decision",
              name: "request_clarification",
              arguments: {
                reason: "missing_period",
                candidateCapability: "late_arrivals",
              },
            }
          : {
              callId: "decision",
              name: "list_late_arrivals",
              arguments: {
                period: "current_month",
                employeeNumber: null,
              },
            },
      ],
      continuation: [],
    };
  }

  async respond() {
    return { answer: "unused", model: "fake-semantic-model" };
  }
}

describe("semantic benchmark runner", () => {
  it("preserves a complete Stage 10 baseline for the same benchmark IDs", () => {
    const baseline = JSON.parse(
      readFileSync(
        new URL(
          "../evals/baselines/stage10-semantic-router.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as {
      summary: { total: number; accuracy: number };
      results: Array<{ id: string }>;
    };
    expect(SEMANTIC_BENCHMARK).toHaveLength(80);
    expect(new Set(SEMANTIC_BENCHMARK.map((item) => item.id)).size).toBe(80);
    expect(baseline.summary).toMatchObject({ total: 80, accuracy: 0.2875 });
    expect(baseline.results.map((item) => item.id)).toEqual(
      SEMANTIC_BENCHMARK.map((item) => item.id),
    );
  });

  it("measures exact outcomes and stability across repeated runs", async () => {
    const report = await runSemanticBenchmark(
      new StableSemanticLlm(),
      cases,
      3,
    );
    expect(report.metrics).toMatchObject({
      cases: 2,
      observations: 6,
      validDecisionRate: 1,
      intentRecognitionRate: 1,
      exactOutcomeRate: 1,
      stabilityRate: 1,
      casePassRate: 1,
      ambiguityPassRate: 1,
    });
    expect(report.results.every((item) => item.passed)).toBe(true);
  });
});
