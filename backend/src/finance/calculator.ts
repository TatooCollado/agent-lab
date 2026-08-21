import { randomUUID } from "node:crypto";
import type { AbsencesOutput } from "../mcp/contracts.js";
import type { FinanceReport, FinanceReportInput } from "./contracts.js";

const FORMULA = "days × dailyCost × (1 + replacementPremiumRate + productivityLossRate)";

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateAbsenceLossReport(
  absences: AbsencesOutput,
  input: FinanceReportInput,
  now: Date = new Date()
): FinanceReport {
  if (absences.truncated) {
    throw new Error("Cannot calculate a complete finance report from truncated absence records");
  }
  const grouped = new Map<string, {
    employeeNumber: string;
    fullName: string;
    departmentCode: string;
    absenceDays: number;
  }>();

  for (const record of absences.records) {
    const current = grouped.get(record.employeeNumber) ?? {
      employeeNumber: record.employeeNumber,
      fullName: record.fullName,
      departmentCode: record.departmentCode,
      absenceDays: 0
    };
    current.absenceDays += 1;
    grouped.set(record.employeeNumber, current);
  }

  const breakdown = [...grouped.values()].map((employee) => {
    const paidAbsenceCost = money(employee.absenceDays * input.dailyCost);
    const replacementPremiumCost = money(paidAbsenceCost * input.replacementPremiumRate);
    const productivityLossCost = money(paidAbsenceCost * input.productivityLossRate);
    return {
      ...employee,
      paidAbsenceCost,
      replacementPremiumCost,
      productivityLossCost,
      totalEstimatedLoss: money(paidAbsenceCost + replacementPremiumCost + productivityLossCost)
    };
  });

  const totals = breakdown.reduce(
    (sum, item) => ({
      paidAbsenceCost: money(sum.paidAbsenceCost + item.paidAbsenceCost),
      replacementPremiumCost: money(sum.replacementPremiumCost + item.replacementPremiumCost),
      productivityLossCost: money(sum.productivityLossCost + item.productivityLossCost),
      totalEstimatedLoss: money(sum.totalEstimatedLoss + item.totalEstimatedLoss)
    }),
    { paidAbsenceCost: 0, replacementPremiumCost: 0, productivityLossCost: 0, totalEstimatedLoss: 0 }
  );

  return {
    reportId: randomUUID(),
    generatedAt: now.toISOString(),
    source: "postgresql",
    period: absences.period,
    assumptions: {
      currency: input.currency,
      dailyCost: input.dailyCost,
      replacementPremiumRate: input.replacementPremiumRate,
      productivityLossRate: input.productivityLossRate,
      formula: FORMULA
    },
    absenceDays: absences.records.length,
    affectedEmployees: breakdown.length,
    breakdown,
    totals
  };
}
