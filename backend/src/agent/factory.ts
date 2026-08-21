import { loadEnv } from "../config/env.js";
import { createConfiguredMcpGateway } from "./mcp-gateway.js";
import { OllamaChatLlm } from "./ollama-llm.js";
import { OpenAIResponsesLlm } from "./openai-llm.js";
import { GroqChatLlm } from "./groq-llm.js";
import { HrAgentOrchestrator } from "./orchestrator.js";

export function createDefaultAgent(): HrAgentOrchestrator {
  const env = loadEnv();
  if (env.LLM_PROVIDER === "ollama") {
    return new HrAgentOrchestrator(
      new OllamaChatLlm(env.OLLAMA_HOST, env.OLLAMA_MODEL),
      () => createConfiguredMcpGateway(),
    );
  }
  if (env.LLM_PROVIDER === "groq") {
    if (!env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not configured");
    }
    return new HrAgentOrchestrator(
      new GroqChatLlm(env.GROQ_API_KEY, env.GROQ_MODEL, undefined, {
        timeoutMs: env.LLM_TIMEOUT_MS,
        transientRetries: env.LLM_TRANSIENT_RETRIES,
        retryDelayMs: 150,
        circuitFailureThreshold: env.LLM_CIRCUIT_FAILURE_THRESHOLD,
        circuitResetMs: env.LLM_CIRCUIT_RESET_MS,
      }),
      () => createConfiguredMcpGateway(),
    );
  }
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new HrAgentOrchestrator(
    new OpenAIResponsesLlm(env.OPENAI_API_KEY, env.OPENAI_MODEL),
    () => createConfiguredMcpGateway(),
  );
}
