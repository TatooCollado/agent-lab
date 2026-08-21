import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool
} from "openai/resources/chat/completions";
import type {
  AgentLlm,
  AgentPlan,
  AgentToolCall,
  AgentToolDefinition
} from "./contracts.js";

type GroqContinuation = { messages: ChatCompletionMessageParam[] };

function isContinuation(value: unknown): value is GroqContinuation {
  return typeof value === "object" && value !== null && "messages" in value && Array.isArray(value.messages);
}

function parseArguments(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Model returned invalid tool arguments");
  }
  return parsed as Record<string, unknown>;
}

function asGroqTools(tools: AgentToolDefinition[]): ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

export class GroqChatLlm implements AgentLlm {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    client?: OpenAI
  ) {
    this.client = client ?? new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1"
    });
  }

  async plan(input: {
    question: string;
    instructions: string;
    tools: AgentToolDefinition[];
  }): Promise<AgentPlan> {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: input.instructions },
      { role: "user", content: input.question }
    ];
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: asGroqTools(input.tools),
      tool_choice: "required",
      parallel_tool_calls: false,
      temperature: 0
    });
    const message = response.choices[0]?.message;
    if (!message) throw new Error("Groq returned no planning message");

    const calls: AgentToolCall[] = (message.tool_calls ?? [])
      .filter((call) => call.type === "function")
      .map((call) => ({
        callId: call.id,
        name: call.function.name,
        arguments: parseArguments(call.function.arguments)
      }));

    return {
      model: response.model,
      calls,
      continuation: {
        messages: [
          ...messages,
          message as unknown as ChatCompletionMessageParam
        ]
      }
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
    if (!isContinuation(input.plan.continuation)) {
      throw new Error("Groq continuation is unavailable");
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        ...input.plan.continuation.messages,
        ...input.toolOutputs.map((toolOutput) => ({
          role: "tool" as const,
          tool_call_id: toolOutput.callId,
          content: JSON.stringify(toolOutput.output)
        }))
      ],
      temperature: 0
    });
    const answer = response.choices[0]?.message.content?.trim();
    if (!answer) throw new Error("Model returned an empty final answer");
    return { answer, model: response.model };
  }
}
