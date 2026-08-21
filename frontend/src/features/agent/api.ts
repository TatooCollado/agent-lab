import type { TraceEvent } from "../execution-trace/types";

export type AgentQueryResponse = {
  requestId: string;
  answer: string;
  model: string;
  grounded: true;
  toolsUsed: string[];
  trace: TraceEvent[];
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
