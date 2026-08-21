import { z } from "zod";
import { traceEventSchema } from "../observability/trace-event.js";
import { periodNameSchema } from "../shared/time/period.js";

export const financeReportInputSchema = z.object({
  period: periodNameSchema,
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  dailyCost: z.number().positive().max(1_000_000_000),
  replacementPremiumRate: z.number().min(0).max(2),
  productivityLossRate: z.number().min(0).max(1)
});

const moneySchema = z.number().nonnegative().finite();

export const financeBreakdownSchema = z.object({
  employeeNumber: z.string(),
  fullName: z.string(),
  departmentCode: z.string(),
  absenceDays: z.number().int().nonnegative(),
  paidAbsenceCost: moneySchema,
  replacementPremiumCost: moneySchema,
  productivityLossCost: moneySchema,
  totalEstimatedLoss: moneySchema
});

export const financeReportSchema = z.object({
  reportId: z.string().uuid(),
  generatedAt: z.string().datetime(),
  source: z.literal("postgresql"),
  period: z.object({
    name: periodNameSchema,
    timezone: z.string(),
    startInclusive: z.string(),
    endExclusive: z.string()
  }),
  assumptions: z.object({
    currency: z.string().length(3),
    dailyCost: moneySchema,
    replacementPremiumRate: z.number().min(0),
    productivityLossRate: z.number().min(0),
    formula: z.string()
  }),
  absenceDays: z.number().int().nonnegative(),
  affectedEmployees: z.number().int().nonnegative(),
  breakdown: z.array(financeBreakdownSchema),
  totals: z.object({
    paidAbsenceCost: moneySchema,
    replacementPremiumCost: moneySchema,
    productivityLossCost: moneySchema,
    totalEstimatedLoss: moneySchema
  })
});

export const financeAgentResultSchema = z.object({
  requestId: z.string().uuid(),
  taskId: z.string().uuid(),
  contextId: z.string().uuid(),
  agent: z.string(),
  report: financeReportSchema,
  trace: z.array(traceEventSchema)
});

export const financeA2aPayloadSchema = z.object({
  requestId: z.string().uuid(),
  input: financeReportInputSchema
});

export const financeWorkflowResultSchema = z.object({
  requestId: z.string().uuid(),
  delegation: z.object({
    clientAgent: z.string(),
    remoteAgent: z.string(),
    protocol: z.literal("A2A"),
    protocolVersion: z.string(),
    transport: z.literal("JSONRPC"),
    taskId: z.string().uuid(),
    contextId: z.string().uuid(),
    artifactName: z.string()
  }),
  report: financeReportSchema,
  trace: z.array(traceEventSchema)
});

export type FinanceReportInput = z.infer<typeof financeReportInputSchema>;
export type FinanceReport = z.infer<typeof financeReportSchema>;
export type FinanceAgentResult = z.infer<typeof financeAgentResultSchema>;
export type FinanceWorkflowResult = z.infer<typeof financeWorkflowResultSchema>;
