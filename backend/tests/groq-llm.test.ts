import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import type { AgentToolDefinition } from "../src/agent/contracts.js";
import { GroqChatLlm } from "../src/agent/groq-llm.js";

const tools: AgentToolDefinition[] = [{
  type: "function",
  name: "find_employee",
  description: "Find an employee",
  parameters: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
    additionalProperties: false
  },
  strict: true
}];

describe("GroqChatLlm", () => {
  it("uses Groq-compatible required tool calling and continues with tool output", async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({
        model: "openai/gpt-oss-20b",
        choices: [{
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call-1",
              type: "function",
              function: { name: "find_employee", arguments: "{\"query\":\"EMP-001\"}" }
            }]
          }
        }]
      })
      .mockResolvedValueOnce({
        model: "openai/gpt-oss-20b",
        choices: [{ message: { role: "assistant", content: "Ana Torres." } }]
      });
    const client = { chat: { completions: { create } } } as unknown as OpenAI;
    const llm = new GroqChatLlm("test-key", "openai/gpt-oss-20b", client);

    const plan = await llm.plan({ question: "Buscá EMP-001", instructions: "Use tools", tools });
    const result = await llm.respond({
      question: "Buscá EMP-001",
      instructions: "Use tools",
      tools,
      plan,
      toolOutputs: [{ callId: "call-1", name: "find_employee", output: { count: 1 } }]
    });

    expect(plan.calls).toEqual([{ callId: "call-1", name: "find_employee", arguments: { query: "EMP-001" } }]);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      model: "openai/gpt-oss-20b",
      tool_choice: "required",
      parallel_tool_calls: false,
      temperature: 0
    });
    expect(create.mock.calls[1]?.[0].messages.at(-1)).toEqual({
      role: "tool",
      tool_call_id: "call-1",
      content: "{\"count\":1}"
    });
    expect(result).toEqual({ answer: "Ana Torres.", model: "openai/gpt-oss-20b" });
  });
});
