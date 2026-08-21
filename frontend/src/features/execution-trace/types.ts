export type TraceEvent = {
  id: string;
  requestId: string;
  timestamp: string;
  category: "system" | "llm" | "agent" | "mcp" | "database" | "a2a" | "guardrail" | "auth";
  name: string;
  status: "started" | "completed" | "failed";
  technology: string;
  component: string;
  concepts: string[];
  input?: unknown;
  output?: unknown;
  durationMs?: number;
  metadata?: Record<string, unknown>;
};
