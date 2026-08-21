import { z } from "zod";

export const evalCheckSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  expected: z.unknown(),
  actual: z.unknown()
});

export const evalResultSchema = z.object({
  caseId: z.string(),
  title: z.string(),
  prompt: z.string(),
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  durationMs: z.number().nonnegative(),
  checks: z.array(evalCheckSchema),
  evidence: z.object({
    model: z.string(),
    toolsUsed: z.array(z.string()),
    grounded: z.boolean(),
    databaseCount: z.number().int().nonnegative().nullable(),
    answer: z.string()
  })
});

export const evalRunSchema = z.object({
  runId: z.string().uuid(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  passRate: z.number().min(0).max(1),
  results: z.array(evalResultSchema)
});

export type EvalCheck = z.infer<typeof evalCheckSchema>;
export type EvalResult = z.infer<typeof evalResultSchema>;
export type EvalRun = z.infer<typeof evalRunSchema>;
