import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import type { AgentRunner } from "../agent/orchestrator.js";
import type { AgentAnswer } from "../agent/contracts.js";
import {
  evalRunSchema,
  type EvalCheck,
  type EvalResult,
  type EvalRun,
} from "./contracts.js";
import type { EvalFixtureManager } from "./fixture-manager.js";

type CaseDefinition = {
  id: string;
  title: string;
  prompt: string;
  expectedTool: string;
  expectedCount: number;
  expectedEmployeeNumber?: string;
  expectsExplicitEmpty?: boolean;
};

function toolEvidence(answer: AgentAnswer): {
  count: number | null;
  records: unknown[];
} {
  const toolEvent = answer.trace.find(
    (item) => item.name === "mcp.tool.call.completed",
  );
  const output = toolEvent?.output;
  if (typeof output !== "object" || output === null || Array.isArray(output)) {
    return { count: null, records: [] };
  }
  const value = output as Record<string, unknown>;
  return {
    count: typeof value.count === "number" ? value.count : null,
    records: Array.isArray(value.records) ? value.records : [],
  };
}

function evaluate(
  definition: CaseDefinition,
  answer: AgentAnswer,
  durationMs: number,
): EvalResult {
  const evidence = toolEvidence(answer);
  const checks: EvalCheck[] = [
    {
      name: "grounded",
      passed: answer.grounded === true,
      expected: true,
      actual: answer.grounded,
    },
    {
      name: "approved_tool",
      passed: answer.toolsUsed.includes(definition.expectedTool),
      expected: definition.expectedTool,
      actual: answer.toolsUsed,
    },
    {
      name: "database_count",
      passed: evidence.count === definition.expectedCount,
      expected: definition.expectedCount,
      actual: evidence.count,
    },
  ];

  if (definition.expectedEmployeeNumber) {
    const found = evidence.records.some(
      (record) =>
        typeof record === "object" &&
        record !== null &&
        "employeeNumber" in record &&
        record.employeeNumber === definition.expectedEmployeeNumber,
    );
    checks.push({
      name: "expected_employee_observed",
      passed: found,
      expected: definition.expectedEmployeeNumber,
      actual: found,
    });
  }
  if (definition.expectsExplicitEmpty) {
    const explicit =
      /no\s+(se\s+)?(encontr|hay)|sin\s+resultados|0\s+resultados/i.test(
        answer.answer,
      );
    checks.push({
      name: "explicit_empty_answer",
      passed: explicit,
      expected: "explicit no-result statement",
      actual: answer.answer,
    });
  }

  const passedChecks = checks.filter((check) => check.passed).length;
  return {
    caseId: definition.id,
    title: definition.title,
    prompt: definition.prompt,
    passed: passedChecks === checks.length,
    score: passedChecks / checks.length,
    durationMs: Math.round(durationMs * 100) / 100,
    checks,
    evidence: {
      model: answer.model,
      toolsUsed: answer.toolsUsed,
      grounded: answer.grounded,
      databaseCount: evidence.count,
      answer: answer.answer,
    },
  };
}

async function runCase(
  agent: AgentRunner,
  definition: CaseDefinition,
): Promise<EvalResult> {
  const startedAt = performance.now();
  try {
    const answer = await agent.run(definition.prompt, randomUUID());
    return evaluate(definition, answer, performance.now() - startedAt);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown execution error";
    return {
      caseId: definition.id,
      title: definition.title,
      prompt: definition.prompt,
      passed: false,
      score: 0,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      checks: [
        {
          name: "execution_completed",
          passed: false,
          expected: true,
          actual: message,
        },
      ],
      evidence: {
        model: "execution-error",
        toolsUsed: [],
        grounded: false,
        databaseCount: null,
        answer: "The evaluation case did not complete.",
      },
    };
  }
}

export async function runAgentEvals(
  agent: AgentRunner,
  fixtures: EvalFixtureManager,
): Promise<EvalRun> {
  const runId = randomUUID();
  const startedAt = new Date();
  const results: EvalResult[] = [];

  results.push(
    await runCase(agent, {
      id: "employee-count",
      title: "Employee count routing",
      prompt: "¿Cuántos empleados hay?",
      expectedTool: "count_employees",
      expectedCount: 3,
    }),
  );

  results.push(
    await runCase(agent, {
      id: "employee-directory",
      title: "Employee directory routing",
      prompt: "¿Quiénes son los empleados?",
      expectedTool: "list_employees",
      expectedCount: 3,
    }),
  );

  results.push(
    await runCase(agent, {
      id: "employee-delay-summary",
      title: "Employee delay aggregation routing",
      prompt: "Pasame las demoras totales de Bruno Silva.",
      expectedTool: "summarize_employee_delays",
      expectedCount: 1,
      expectedEmployeeNumber: "EMP-002",
    }),
  );

  results.push(
    await runCase(agent, {
      id: "known-late-arrivals",
      title: "Known grounded records",
      prompt: "¿Qué empleados llegaron tarde durante el último mes?",
      expectedTool: "list_late_arrivals",
      expectedCount: 2,
    }),
  );

  results.push(
    await runCase(agent, {
      id: "unknown-employee",
      title: "No hallucination on empty result",
      prompt: "Buscá al empleado EMP-NOT-FOUND-EVAL.",
      expectedTool: "find_employee",
      expectedCount: 0,
      expectsExplicitEmpty: true,
    }),
  );

  const fixture = await fixtures.createFreshnessFixture();
  try {
    results.push(
      await runCase(agent, {
        id: "source-of-truth-freshness",
        title: "Fresh database update",
        prompt: `¿Qué llegadas tarde tuvo el empleado ${fixture.employeeNumber} durante el último mes?`,
        expectedTool: "list_late_arrivals",
        expectedCount: 1,
        expectedEmployeeNumber: fixture.employeeNumber,
      }),
    );
  } finally {
    await fixtures.cleanupFreshnessFixture(fixture);
  }

  const passed = results.filter((result) => result.passed).length;
  return evalRunSchema.parse({
    runId,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    passed,
    failed: results.length - passed,
    total: results.length,
    passRate: passed / results.length,
    results,
  });
}
