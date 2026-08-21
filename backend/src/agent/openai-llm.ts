import OpenAI from "openai";
import type {
  FunctionTool,
  ResponseInput,
  ResponseInputItem
} from "openai/resources/responses/responses";
import type {
  AgentLlm,
  AgentPlan,
  AgentToolCall,
  AgentToolDefinition
} from "./contracts.js";

function asFunctionTools(tools: AgentToolDefinition[]): FunctionTool[] {
  return tools as FunctionTool[];
}

function parseArguments(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Model returned invalid tool arguments");
  }
  return parsed as Record<string, unknown>;
}

export class OpenAIResponsesLlm implements AgentLlm {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async plan(input: {
    question: string;
    instructions: string;
    tools: AgentToolDefinition[];
  }): Promise<AgentPlan> {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: input.instructions,
      input: [{ role: "user", content: input.question }],
      tools: asFunctionTools(input.tools),
      tool_choice: "required",
      parallel_tool_calls: false,
      store: false
    });

    const calls: AgentToolCall[] = response.output
      .filter((item) => item.type === "function_call")
      .map((item) => ({
        callId: item.call_id,
        name: item.name,
        arguments: parseArguments(item.arguments)
      }));

    return {
      model: response.model,
      calls,
      continuation: response.output
    };
  }

  async respond(input: {
    question: string;
    instructions: string;
    tools: AgentToolDefinition[];
    plan: AgentPlan;
    toolOutputs: Array<{
      callId: string;
      name: string;
      output: Record<string, unknown>;
    }>;
  }): Promise<{ answer: string; model: string }> {
    if (!Array.isArray(input.plan.continuation)) {
      throw new Error("OpenAI continuation is unavailable");
    }

    const conversation: ResponseInput = [
      { role: "user", content: input.question },
      ...(input.plan.continuation as ResponseInputItem[]),
      ...input.toolOutputs.map((toolOutput) => ({
        type: "function_call_output" as const,
        call_id: toolOutput.callId,
        output: JSON.stringify(toolOutput.output)
      }))
    ];

    const response = await this.client.responses.create({
      model: this.model,
      instructions: input.instructions,
      input: conversation,
      tools: asFunctionTools(input.tools),
      tool_choice: "none",
      parallel_tool_calls: false,
      store: false
    });
    const answer = response.output_text.trim();
    if (!answer) throw new Error("Model returned an empty final answer");
    return { answer, model: response.model };
  }
}
