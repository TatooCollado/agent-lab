import type { TraceEvent } from "../execution-trace/types";

export type AgentQueryResponse = {
  requestId: string;
  answer: string;
  model: string;
  grounded: true;
  toolsUsed: string[];
  trace: TraceEvent[];
};

export async function runAgentQuery(question: string): Promise<AgentQueryResponse> {
  const response = await fetch("/api/agent/query", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question })
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const code =
      typeof body === "object" && body !== null && "error" in body
        ? String(body.error)
        : "unknown_error";
    throw new Error(code);
  }

  return (await response.json()) as AgentQueryResponse;
}
