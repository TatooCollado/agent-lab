import type { TraceEvent } from "../execution-trace/types";

export type FinanceReportInput = {
  period: "current_month" | "previous_calendar_month" | "last_30_days";
  currency: string;
  dailyCost: number;
  replacementPremiumRate: number;
  productivityLossRate: number;
};

export type FinanceWorkflowResult = {
  requestId: string;
  delegation: {
    clientAgent: string;
    remoteAgent: string;
    protocol: "A2A";
    protocolVersion: string;
    transport: "JSONRPC";
    taskId: string;
    contextId: string;
    artifactName: string;
  };
  report: {
    reportId: string;
    generatedAt: string;
    source: "postgresql";
    period: { name: string; timezone: string; startInclusive: string; endExclusive: string };
    assumptions: FinanceReportInput & { formula: string };
    absenceDays: number;
    affectedEmployees: number;
    breakdown: Array<{
      employeeNumber: string;
      fullName: string;
      departmentCode: string;
      absenceDays: number;
      paidAbsenceCost: number;
      replacementPremiumCost: number;
      productivityLossCost: number;
      totalEstimatedLoss: number;
    }>;
    totals: {
      paidAbsenceCost: number;
      replacementPremiumCost: number;
      productivityLossCost: number;
      totalEstimatedLoss: number;
    };
  };
  trace: TraceEvent[];
};

async function responseError(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  return typeof body === "object" && body !== null && "error" in body ? String(body.error) : "unknown_error";
}

export async function runFinanceReport(input: FinanceReportInput): Promise<FinanceWorkflowResult> {
  const response = await fetch("/api/finance/absence-loss-report", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error(await responseError(response));
  return (await response.json()) as FinanceWorkflowResult;
}

export type AgentCard = {
  name: string;
  description: string;
  version: string;
  supportedInterfaces: Array<{ protocolBinding: string; protocolVersion: string; url: string }>;
  skills: Array<{ id: string; name: string; description: string; tags: string[] }>;
};

export async function getAgentCards(): Promise<AgentCard[]> {
  const response = await fetch("/api/agents/cards", { credentials: "include" });
  if (!response.ok) throw new Error(await responseError(response));
  return ((await response.json()) as { cards: AgentCard[] }).cards;
}
