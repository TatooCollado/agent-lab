import type { TraceEvent } from "../execution-trace/types";

type ResultMetadata = {
  source: "postgresql";
  queriedAt: string;
  count: number;
  total: number;
  truncated: boolean;
};

export type EmployeeRecord = {
  employeeId: string;
  employeeNumber: string;
  fullName: string;
  departmentCode: string;
  departmentName: string;
  timezone: string;
  active: boolean;
};

type Period = {
  name: "current_month" | "previous_calendar_month" | "last_30_days";
  timezone: string;
  startInclusive: string;
  endExclusive: string;
};

export type AnswerPresentation =
  | {
      kind: "employee_count";
      data: ResultMetadata & { active: number; inactive: number };
    }
  | {
      kind: "employee_directory";
      data: ResultMetadata & { records: EmployeeRecord[] };
    }
  | {
      kind: "employees_without_late_arrivals";
      data: ResultMetadata & { period: Period; records: EmployeeRecord[] };
    }
  | {
      kind: "employee_search";
      data: ResultMetadata & { query: string; records: EmployeeRecord[] };
    }
  | {
      kind: "employee_delay_summary";
      data: ResultMetadata & {
        query: string;
        records: Array<{
          employeeId: string;
          employeeNumber: string;
          fullName: string;
          departmentCode: string;
          occurrences: number;
          totalLateMinutes: number;
          averageLateMinutes: number;
          maximumLateMinutes: number;
          firstOccurrenceDate: string;
          lastOccurrenceDate: string;
        }>;
      };
    }
  | {
      kind: "late_arrivals";
      data: ResultMetadata & {
        period: Period;
        employeeNumber: string | null;
        records: Array<{
          employeeId: string;
          employeeNumber: string;
          fullName: string;
          departmentCode: string;
          workDate: string;
          scheduledStart: string;
          actualArrival: string;
          lateMinutes: number;
        }>;
      };
    }
  | {
      kind: "absences";
      data: ResultMetadata & {
        period: Period;
        employeeNumber: string | null;
        records: Array<{
          employeeId: string;
          employeeNumber: string;
          fullName: string;
          departmentCode: string;
          workDate: string;
          scheduledStart: string;
          absenceReason: string | null;
        }>;
      };
    };

export type AgentQueryResponse = {
  requestId: string;
  answer: string;
  model: string;
  grounded: true;
  toolsUsed: string[];
  presentation: AnswerPresentation;
  trace: TraceEvent[];
};

export type AgentCapability = {
  id: string;
  label: string;
  tool: string;
  examples: string[];
};

export class AgentQueryError extends Error {
  constructor(
    public readonly code: string,
    public readonly requestId?: string,
  ) {
    super(code);
  }
}

export async function runAgentQuery(
  question: string,
): Promise<AgentQueryResponse> {
  const response = await fetch("/api/agent/query", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const code =
      typeof body === "object" && body !== null && "error" in body
        ? String(body.error)
        : "unknown_error";
    const requestId =
      typeof body === "object" && body !== null && "requestId" in body
        ? String(body.requestId)
        : undefined;
    throw new AgentQueryError(code, requestId);
  }

  return (await response.json()) as AgentQueryResponse;
}

export async function getAgentCapabilities(): Promise<AgentCapability[]> {
  const response = await fetch("/api/agent/capabilities");
  if (!response.ok) throw new Error("capability_catalog_unavailable");
  const body = (await response.json()) as { capabilities: AgentCapability[] };
  return body.capabilities;
}
