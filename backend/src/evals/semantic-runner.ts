import type { AgentLlm } from "../agent/contracts.js";
import {
  AgentClarificationRequiredError,
  AGENT_CAPABILITIES,
  InvalidAgentDecisionError,
  semanticPlanningTools,
  UnsupportedAgentQueryError,
  validateAgentDecision,
} from "../agent/capability-router.js";
import { controlledTools } from "../agent/tool-catalog.js";
import { HR_AGENT_SYSTEM_PROMPT } from "../agent/system-prompt.js";
import { ProviderResilienceError } from "../resilience/provider-resilience.js";
import type {
  SemanticBenchmarkCase,
  SemanticOutcome,
} from "./semantic-benchmark.js";

export type SemanticObservation = {
  repetition: number;
  intent: string | null;
  outcome: SemanticOutcome | { kind: "invalid"; reason: string };
  failureKind: "none" | "provider" | "decision";
  validDecision: boolean;
  intentCorrect: boolean;
  outcomeCorrect: boolean;
};

export type SemanticCaseResult = {
  id: string;
  capability: string | null;
  variant: string;
  question: string;
  expected: SemanticOutcome;
  stable: boolean;
  passed: boolean;
  observations: SemanticObservation[];
};

function normalizeArguments(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== null && item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function outcomeSignature(value: SemanticObservation["outcome"]): string {
  if (value.kind === "execute") {
    return JSON.stringify({
      kind: value.kind,
      tool: value.tool,
      arguments: normalizeArguments(value.arguments),
    });
  }
  return JSON.stringify(value);
}

function outcomesEqual(
  expected: SemanticOutcome,
  actual: SemanticObservation["outcome"],
): boolean {
  if (expected.kind !== actual.kind) return false;
  if (expected.kind === "execute" && actual.kind === "execute") {
    return (
      expected.tool === actual.tool &&
      JSON.stringify(normalizeArguments(expected.arguments)) ===
        JSON.stringify(normalizeArguments(actual.arguments))
    );
  }
  if (expected.kind === "clarification" && actual.kind === "clarification") {
    return expected.reason === actual.reason;
  }
  if (expected.kind === "unsupported" && actual.kind === "unsupported") {
    return expected.reason === actual.reason;
  }
  return false;
}

function interpretDecision(
  definition: SemanticBenchmarkCase,
  calls: Parameters<typeof validateAgentDecision>[1],
  tools: ReturnType<typeof controlledTools>,
): Omit<SemanticObservation, "repetition"> {
  try {
    const decision = validateAgentDecision(definition.question, calls, tools);
    const outcome: SemanticOutcome = {
      kind: "execute",
      tool: decision.call.name,
      arguments: decision.call.arguments,
    };
    return {
      intent: decision.capability.id,
      outcome,
      failureKind: "none",
      validDecision: true,
      intentCorrect: decision.capability.id === definition.capability,
      outcomeCorrect: outcomesEqual(definition.expected, outcome),
    };
  } catch (error) {
    if (error instanceof AgentClarificationRequiredError) {
      const outcome: SemanticOutcome = {
        kind: "clarification",
        reason: error.reason,
      };
      return {
        intent: error.candidateCapability,
        outcome,
        failureKind: "none",
        validDecision: true,
        intentCorrect: error.candidateCapability === definition.capability,
        outcomeCorrect: outcomesEqual(definition.expected, outcome),
      };
    }
    if (error instanceof UnsupportedAgentQueryError) {
      const outcome: SemanticOutcome = {
        kind: "unsupported",
        reason: error.reason,
      };
      return {
        intent: error.candidateCapability,
        outcome,
        failureKind: "none",
        validDecision: true,
        intentCorrect: error.candidateCapability === definition.capability,
        outcomeCorrect: outcomesEqual(definition.expected, outcome),
      };
    }
    const reason =
      error instanceof InvalidAgentDecisionError
        ? error.message
        : error instanceof Error
          ? error.message
          : "unknown_error";
    return {
      intent: null,
      outcome: { kind: "invalid", reason },
      failureKind: "decision",
      validDecision: false,
      intentCorrect: false,
      outcomeCorrect: false,
    };
  }
}

export async function runSemanticBenchmark(
  llm: AgentLlm,
  cases: readonly SemanticBenchmarkCase[],
  repetitions: number,
  delayMs = 0,
) {
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10) {
    throw new Error("Semantic benchmark repetitions must be between 1 and 10");
  }
  const tools = controlledTools(AGENT_CAPABILITIES.map((item) => item.tool));
  const planningTools = semanticPlanningTools(tools);
  const results: SemanticCaseResult[] = [];

  for (const definition of cases) {
    const observations: SemanticObservation[] = [];
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      try {
        const plan = await llm.plan({
          question: definition.question,
          instructions: HR_AGENT_SYSTEM_PROMPT,
          tools: planningTools,
        });
        observations.push({
          repetition,
          ...interpretDecision(definition, plan.calls, tools),
        });
      } catch (error) {
        observations.push({
          repetition,
          intent: null,
          outcome: {
            kind: "invalid",
            reason:
              error instanceof ProviderResilienceError
                ? error.code
                : error instanceof Error
                  ? error.message
                  : "provider_error",
          },
          failureKind:
            error instanceof ProviderResilienceError ? "provider" : "decision",
          validDecision: false,
          intentCorrect: false,
          outcomeCorrect: false,
        });
      }
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    const stable =
      new Set(observations.map((item) => outcomeSignature(item.outcome)))
        .size === 1;
    results.push({
      ...definition,
      stable,
      passed: stable && observations.every((item) => item.outcomeCorrect),
      observations,
    });
  }

  const observations = results.flatMap((result) => result.observations);
  const providerFailures = observations.filter(
    (item) => item.failureKind === "provider",
  ).length;
  const decisionFailures = observations.filter(
    (item) => item.failureKind === "decision",
  ).length;
  const expectedExecutions = results.filter(
    (result) => result.expected.kind === "execute",
  );
  const expectedClarifications = results.filter(
    (result) => result.expected.kind === "clarification",
  );
  const expectedUnsupported = results.filter(
    (result) => result.expected.kind === "unsupported",
  );
  const executionObservations = expectedExecutions.flatMap((result) =>
    result.observations.map((observation) => ({ result, observation })),
  );
  const temporalObservations = results
    .filter(
      (result) =>
        (result.expected.kind === "execute" &&
          typeof result.expected.arguments.period === "string") ||
        (result.expected.kind === "clarification" &&
          ["missing_period", "conflicting_period"].includes(
            result.expected.reason,
          )),
    )
    .flatMap((result) =>
      result.observations.map((observation) => ({ result, observation })),
    );
  const rate = (count: number, total: number) =>
    total === 0 ? 1 : Math.round((count / total) * 10_000) / 10_000;

  return {
    schemaVersion: 1,
    benchmark: "semantic-benchmark-v1",
    status:
      providerFailures === 0 ? "complete" : "inconclusive_provider_failure",
    semanticMetricsValid: providerFailures === 0,
    repetitions,
    generatedAt: new Date().toISOString(),
    metrics: {
      cases: results.length,
      observations: observations.length,
      validDecisionRate: rate(
        observations.filter((item) => item.validDecision).length,
        observations.length,
      ),
      providerOrDecisionFailureRate: rate(
        observations.filter((item) => !item.validDecision).length,
        observations.length,
      ),
      providerFailureRate: rate(providerFailures, observations.length),
      invalidDecisionRate: rate(decisionFailures, observations.length),
      intentRecognitionRate: rate(
        observations.filter((item) => item.intentCorrect).length,
        observations.length,
      ),
      exactOutcomeRate: rate(
        observations.filter((item) => item.outcomeCorrect).length,
        observations.length,
      ),
      toolSelectionRate: rate(
        executionObservations.filter(
          ({ result, observation }) =>
            result.expected.kind === "execute" &&
            observation.outcome.kind === "execute" &&
            observation.outcome.tool === result.expected.tool,
        ).length,
        executionObservations.length,
      ),
      argumentExtractionRate: rate(
        executionObservations.filter(
          ({ result, observation }) =>
            result.expected.kind === "execute" &&
            observation.outcome.kind === "execute" &&
            outcomesEqual(result.expected, observation.outcome),
        ).length,
        executionObservations.length,
      ),
      temporalInterpretationRate: rate(
        temporalObservations.filter(({ result, observation }) =>
          outcomesEqual(result.expected, observation.outcome),
        ).length,
        temporalObservations.length,
      ),
      stabilityRate: rate(
        results.filter((item) => item.stable).length,
        results.length,
      ),
      casePassRate: rate(
        results.filter((item) => item.passed).length,
        results.length,
      ),
      executionPassRate: rate(
        expectedExecutions.filter((item) => item.passed).length,
        expectedExecutions.length,
      ),
      ambiguityPassRate: rate(
        expectedClarifications.filter((item) => item.passed).length,
        expectedClarifications.length,
      ),
      unsupportedPassRate: rate(
        expectedUnsupported.filter((item) => item.passed).length,
        expectedUnsupported.length,
      ),
    },
    results,
  };
}
