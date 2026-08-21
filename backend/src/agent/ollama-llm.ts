import { randomUUID } from "node:crypto";
import { Ollama, type Message, type Tool } from "ollama";
import type {
  AgentLlm,
  AgentPlan,
  AgentToolCall,
  AgentToolDefinition
} from "./contracts.js";

type OllamaContinuation = Message[];

function asOllamaTools(tools: AgentToolDefinition[]): Tool[] {
  return tools.map((tool) => ({
    type: tool.type,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  })) as Tool[];
}

function isContinuation(value: unknown): value is OllamaContinuation {
  return Array.isArray(value);
}

export class OllamaChatLlm implements AgentLlm {
  private readonly client: Ollama;

  constructor(
    host: string,
    private readonly model: string
  ) {
    this.client = new Ollama({ host });
  }

  async plan(input: {
    question: string;
    instructions: string;
    tools: AgentToolDefinition[];
  }): Promise<AgentPlan> {
    const messages: Message[] = [
      { role: "system", content: input.instructions },
      { role: "user", content: input.question }
    ];
    const response = await this.client.chat({
      model: this.model,
      messages,
      tools: asOllamaTools(input.tools),
      think: false,
      stream: false,
      options: { temperature: 0 }
    });

    const calls: AgentToolCall[] = (response.message.tool_calls ?? []).map(
      (call) => ({
        callId: randomUUID(),
        name: call.function.name,
        arguments: call.function.arguments
      })
    );

    return {
      model: response.model,
      calls,
      continuation: [...messages, response.message]
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
      throw new Error("Ollama continuation is unavailable");
    }

    const response = await this.client.chat({
      model: this.model,
      messages: [
        ...input.plan.continuation,
        ...input.toolOutputs.map((toolOutput) => ({
          role: "tool",
          tool_name: toolOutput.name,
          content: JSON.stringify(toolOutput.output)
        }))
      ],
      think: false,
      stream: false,
      options: { temperature: 0 }
    });
    const answer = response.message.content.trim();
    if (!answer) throw new Error("Model returned an empty final answer");
    return { answer, model: response.model };
  }
}
