import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import type { AgentToolDefinition } from "../src/agent/contracts.js";
import { GroqChatLlm } from "../src/agent/groq-llm.js";

const tools: AgentToolDefinition[] = [
  {
    type: "function",
    name: "find_employee",
    description: "Find an employee",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
];

describe("GroqChatLlm", () => {
  it("uses Groq-compatible required tool calling and continues with tool output", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        model: "openai/gpt-oss-20b",
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call-1",
                  type: "function",
                  function: {
                    name: "find_employee",
                    arguments: '{"query":"EMP-001"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        model: "openai/gpt-oss-20b",
        choices: [{ message: { role: "assistant", content: "Ana Torres." } }],
      });
    const client = { chat: { completions: { create } } } as unknown as OpenAI;
    const llm = new GroqChatLlm("test-key", "openai/gpt-oss-20b", client);

    const plan = await llm.plan({
      question: "Buscá EMP-001",
      instructions: "Use tools",
      tools,
    });
    const result = await llm.respond({
      question: "Buscá EMP-001",
      instructions: "Use tools",
      tools,
      plan,
      toolOutputs: [
        { callId: "call-1", name: "find_employee", output: { count: 1 } },
      ],
    });

    expect(plan.calls).toEqual([
      {
        callId: "call-1",
        name: "find_employee",
        arguments: { query: "EMP-001" },
      },
    ]);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      model: "openai/gpt-oss-20b",
      tool_choice: "required",
      parallel_tool_calls: false,
      temperature: 0,
    });
    expect(create.mock.calls[1]?.[0].messages.at(-1)).toEqual({
      role: "tool",
      tool_call_id: "call-1",
      content: '{"count":1}',
    });
    expect(result).toMatchObject({
      answer: "Ana Torres.",
      model: "openai/gpt-oss-20b",
    });
  });

  it("retries once when Groq reports that the required tool was not called", async () => {
    const missingToolError = Object.assign(
      new Error("400 Tool choice is required, but model did not call a tool"),
      { status: 400 },
    );
    const create = vi
      .fn()
      .mockRejectedValueOnce(missingToolError)
      .mockResolvedValueOnce({
        model: "openai/gpt-oss-20b",
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call-retry",
                  type: "function",
                  function: {
                    name: "find_employee",
                    arguments: '{"query":"EMP-001"}',
                  },
                },
              ],
            },
          },
        ],
      });
    const client = { chat: { completions: { create } } } as unknown as OpenAI;
    const llm = new GroqChatLlm("test-key", "openai/gpt-oss-20b", client);

    const plan = await llm.plan({
      question: "Buscá EMP-001",
      instructions: "Use tools",
      tools,
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1]?.[0].messages[0].content).toMatch(
      /exactamente una herramienta/i,
    );
    expect(plan.calls[0]).toMatchObject({
      callId: "call-retry",
      name: "find_employee",
    });
  });

  it("recovers when Groq returns an empty final answer", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        model: "openai/gpt-oss-20b",
        choices: [{ message: { role: "assistant", content: null } }],
      })
      .mockResolvedValueOnce({
        model: "openai/gpt-oss-20b",
        choices: [{ message: { role: "assistant", content: "Carla Méndez." } }],
      });
    const client = { chat: { completions: { create } } } as unknown as OpenAI;
    const llm = new GroqChatLlm("test-key", "openai/gpt-oss-20b", client);

    const result = await llm.respond({
      question: "¿Quién no llegó tarde?",
      instructions: "Use grounded data",
      tools,
      plan: {
        model: "openai/gpt-oss-20b",
        calls: [],
        continuation: { messages: [{ role: "user", content: "question" }] },
      },
      toolOutputs: [
        {
          callId: "call-1",
          name: "list_employees_without_late_arrivals",
          output: { count: 1, records: [{ fullName: "Carla Méndez" }] },
        },
      ],
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1]?.[0].messages[0].content).toMatch(
      /únicamente con texto final/i,
    );
    expect(result.answer).toBe("Carla Méndez.");
    expect(result.recovery).toBe("empty_final_answer_retry");
  });

  it("recovers when Groq attempts a second tool call during finalization", async () => {
    const unexpectedToolError = Object.assign(
      new Error("400 Tool choice is none, but model called a tool"),
      { status: 400 },
    );
    const create = vi
      .fn()
      .mockRejectedValueOnce(unexpectedToolError)
      .mockResolvedValueOnce({
        model: "openai/gpt-oss-20b",
        choices: [
          { message: { role: "assistant", content: "Resultado grounded." } },
        ],
      });
    const client = { chat: { completions: { create } } } as unknown as OpenAI;
    const llm = new GroqChatLlm("test-key", "openai/gpt-oss-20b", client);

    const result = await llm.respond({
      question: "Consulta",
      instructions: "Use grounded data",
      tools,
      plan: {
        model: "openai/gpt-oss-20b",
        calls: [],
        continuation: { messages: [{ role: "user", content: "question" }] },
      },
      toolOutputs: [
        { callId: "call-1", name: "find_employee", output: { count: 1 } },
      ],
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(result.answer).toBe("Resultado grounded.");
    expect(result.recovery).toBe("unexpected_final_tool_call_retry");
  });
});
