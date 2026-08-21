import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnv } from "../config/env.js";
import { GroqChatLlm } from "../agent/groq-llm.js";
import { SEMANTIC_BENCHMARK } from "./semantic-benchmark.js";
import { runSemanticBenchmark } from "./semantic-runner.js";

const repetitionsArgument = process.argv.find((item) =>
  item.startsWith("--repetitions="),
);
const repetitions = Number(repetitionsArgument?.split("=")[1] ?? 1);
const delayArgument = process.argv.find((item) =>
  item.startsWith("--delay-ms="),
);
const delayMs = Number(delayArgument?.split("=")[1] ?? 30_000);
const outputArgument = process.argv.find((item) =>
  item.startsWith("--output="),
);
const selectedArgument = process.argv.find((item) =>
  item.startsWith("--case-prefix="),
);
const prefix = selectedArgument?.split("=")[1];
const idsArgument = process.argv.find((item) => item.startsWith("--case-ids="));
const profileArgument = process.argv.find((item) =>
  item.startsWith("--profile="),
);
const profile = profileArgument?.split("=")[1];
const criticalIds = [
  "late-arrivals-4",
  "late-arrivals-9",
  "late-arrivals-10",
  "without-late-arrivals-5",
  "boundary-1",
];
const ids = new Set(
  profile === "critical"
    ? criticalIds
    : (idsArgument?.split("=")[1]?.split(",") ?? []),
);
const limitArgument = process.argv.find((item) => item.startsWith("--limit="));
const limit = Number(limitArgument?.split("=")[1] ?? Number.POSITIVE_INFINITY);
const selectedCases = ids.size
  ? SEMANTIC_BENCHMARK.filter((item) => ids.has(item.id))
  : prefix
    ? SEMANTIC_BENCHMARK.filter((item) => item.id.startsWith(prefix))
    : SEMANTIC_BENCHMARK;
const cases = selectedCases.slice(0, limit);

const env = loadEnv();
if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");
const llm = new GroqChatLlm(env.GROQ_API_KEY, env.GROQ_MODEL, undefined, {
  timeoutMs: env.LLM_TIMEOUT_MS,
  transientRetries: env.LLM_TRANSIENT_RETRIES,
  retryDelayMs: 150,
  circuitFailureThreshold: env.LLM_CIRCUIT_FAILURE_THRESHOLD,
  circuitResetMs: env.LLM_CIRCUIT_RESET_MS,
});
const report = await runSemanticBenchmark(llm, cases, repetitions, delayMs);

if (outputArgument) {
  const output = resolve(outputArgument.split("=")[1]!);
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
const verbose = process.argv.includes("--verbose");
console.log(
  JSON.stringify(
    verbose
      ? report
      : {
          benchmark: report.benchmark,
          status: report.status,
          semanticMetricsValid: report.semanticMetricsValid,
          repetitions: report.repetitions,
          metrics: report.metrics,
          failedCases: report.results
            .filter((item) => !item.passed)
            .map((item) => item.id),
        },
  ),
);
if (report.metrics.validDecisionRate < 1) process.exitCode = 1;
