import { z } from "zod";
import { periodNameSchema } from "../shared/time/period.js";

export const findEmployeeInputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe("Nombre o número de empleado"),
});

export const periodInputSchema = z.object({
  period: periodNameSchema.describe("Período calendario predefinido"),
  employeeNumber: z.string().trim().min(1).max(50).optional(),
});

export const periodOnlyInputSchema = z.object({
  period: periodNameSchema.describe("Período calendario predefinido"),
});

const resultMetadataSchema = z.object({
  source: z.literal("postgresql"),
  queriedAt: z.string(),
  count: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  truncated: z.boolean(),
});

export const countEmployeesInputSchema = z.object({});

export const countEmployeesOutputSchema = resultMetadataSchema.extend({
  active: z.number().int().nonnegative(),
  inactive: z.number().int().nonnegative(),
});

export const listEmployeesInputSchema = z.object({});

export const summarizeEmployeeDelaysInputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe("Nombre o número de empleado"),
});

export const employeeDelaySummaryRecordSchema = z.object({
  employeeId: z.string().uuid(),
  employeeNumber: z.string(),
  fullName: z.string(),
  departmentCode: z.string(),
  occurrences: z.number().int().nonnegative(),
  totalLateMinutes: z.number().int().nonnegative(),
  averageLateMinutes: z.number().int().nonnegative(),
  maximumLateMinutes: z.number().int().nonnegative(),
  firstOccurrenceDate: z.string(),
  lastOccurrenceDate: z.string(),
});

export const summarizeEmployeeDelaysOutputSchema = resultMetadataSchema.extend({
  query: z.string(),
  records: z.array(employeeDelaySummaryRecordSchema),
});

export const employeeRecordSchema = z.object({
  employeeId: z.string().uuid(),
  employeeNumber: z.string(),
  fullName: z.string(),
  departmentCode: z.string(),
  departmentName: z.string(),
  timezone: z.string(),
  active: z.boolean(),
});

export const listEmployeesOutputSchema = resultMetadataSchema.extend({
  records: z.array(employeeRecordSchema),
});

export const lateArrivalRecordSchema = z.object({
  employeeId: z.string().uuid(),
  employeeNumber: z.string(),
  fullName: z.string(),
  departmentCode: z.string(),
  workDate: z.string(),
  scheduledStart: z.string(),
  actualArrival: z.string(),
  lateMinutes: z.number().int().positive(),
});

export const absenceRecordSchema = z.object({
  employeeId: z.string().uuid(),
  employeeNumber: z.string(),
  fullName: z.string(),
  departmentCode: z.string(),
  workDate: z.string(),
  scheduledStart: z.string(),
  absenceReason: z.string().nullable(),
});

const periodSchema = z.object({
  name: periodNameSchema,
  timezone: z.string(),
  startInclusive: z.string(),
  endExclusive: z.string(),
});

export const findEmployeeOutputSchema = resultMetadataSchema.extend({
  query: z.string(),
  records: z.array(employeeRecordSchema),
});

export const lateArrivalsOutputSchema = resultMetadataSchema.extend({
  period: periodSchema,
  employeeNumber: z.string().nullable(),
  records: z.array(lateArrivalRecordSchema),
});

export const employeesWithoutLateArrivalsOutputSchema =
  resultMetadataSchema.extend({
    period: periodSchema,
    records: z.array(employeeRecordSchema),
  });

export const absencesOutputSchema = resultMetadataSchema.extend({
  period: periodSchema,
  employeeNumber: z.string().nullable(),
  records: z.array(absenceRecordSchema),
});

export type FindEmployeeInput = z.infer<typeof findEmployeeInputSchema>;
export type CountEmployeesOutput = z.infer<typeof countEmployeesOutputSchema>;
export type ListEmployeesOutput = z.infer<typeof listEmployeesOutputSchema>;
export type SummarizeEmployeeDelaysInput = z.infer<
  typeof summarizeEmployeeDelaysInputSchema
>;
export type SummarizeEmployeeDelaysOutput = z.infer<
  typeof summarizeEmployeeDelaysOutputSchema
>;
export type PeriodInput = z.infer<typeof periodInputSchema>;
export type PeriodOnlyInput = z.infer<typeof periodOnlyInputSchema>;
export type FindEmployeeOutput = z.infer<typeof findEmployeeOutputSchema>;
export type LateArrivalsOutput = z.infer<typeof lateArrivalsOutputSchema>;
export type EmployeesWithoutLateArrivalsOutput = z.infer<
  typeof employeesWithoutLateArrivalsOutputSchema
>;
export type AbsencesOutput = z.infer<typeof absencesOutputSchema>;
