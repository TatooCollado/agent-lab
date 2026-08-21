import { z } from "zod";
import { traceEventSchema } from "../observability/trace-event.js";
import {
  absencesOutputSchema,
  countEmployeesOutputSchema,
  employeesWithoutLateArrivalsOutputSchema,
  findEmployeeOutputSchema,
  lateArrivalsOutputSchema,
  listEmployeesOutputSchema,
  summarizeEmployeeDelaysOutputSchema,
} from "../mcp/contracts.js";

export const agentQuerySchema = z.object({
  question: z.string().trim().min(3).max(1_000),
});

export const answerPresentationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("employee_count"),
    data: countEmployeesOutputSchema,
  }),
  z.object({
    kind: z.literal("employee_directory"),
    data: listEmployeesOutputSchema,
  }),
  z.object({
    kind: z.literal("employees_without_late_arrivals"),
    data: employeesWithoutLateArrivalsOutputSchema,
  }),
  z.object({
    kind: z.literal("employee_search"),
    data: findEmployeeOutputSchema,
  }),
  z.object({
    kind: z.literal("employee_delay_summary"),
    data: summarizeEmployeeDelaysOutputSchema,
  }),
  z.object({
    kind: z.literal("late_arrivals"),
    data: lateArrivalsOutputSchema,
  }),
  z.object({ kind: z.literal("absences"), data: absencesOutputSchema }),
]);

export const agentAnswerSchema = z.object({
  requestId: z.string().uuid(),
  answer: z.string().min(1),
  model: z.string().min(1),
  grounded: z.literal(true),
  toolsUsed: z.array(z.string().min(1)).min(1),
  presentation: answerPresentationSchema,
  trace: z.array(traceEventSchema),
});

export type AgentQuery = z.infer<typeof agentQuerySchema>;
export type AgentAnswer = z.infer<typeof agentAnswerSchema>;
export type AnswerPresentation = z.infer<typeof answerPresentationSchema>;

export type AgentToolDefinition = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: true;
};

export type AgentToolCall = {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type AgentToolOutput = {
  callId: string;
  name: string;
  output: Record<string, unknown>;
};

export type AgentPlan = {
  model: string;
  calls: AgentToolCall[];
  continuation: unknown;
};

export interface AgentLlm {
  resilienceSnapshot?(): unknown;
  plan(input: {
    question: string;
    instructions: string;
    tools: AgentToolDefinition[];
  }): Promise<AgentPlan>;
  respond(input: {
    question: string;
    instructions: string;
    tools: AgentToolDefinition[];
    plan: AgentPlan;
    toolOutputs: AgentToolOutput[];
  }): Promise<{ answer: string; model: string; recovery?: string }>;
}
