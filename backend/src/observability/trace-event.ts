import { z } from "zod";

export const traceCategorySchema = z.enum([
  "system",
  "llm",
  "agent",
  "mcp",
  "database",
  "a2a",
  "guardrail",
  "auth"
]);

export const traceStatusSchema = z.enum(["started", "completed", "failed"]);

export const traceEventSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  timestamp: z.string().datetime(),
  category: traceCategorySchema,
  name: z.string().min(1),
  status: traceStatusSchema,
  technology: z.string().min(1),
  component: z.string().min(1),
  concepts: z.array(z.string().min(1)),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  durationMs: z.number().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export type TraceEvent = z.infer<typeof traceEventSchema>;

