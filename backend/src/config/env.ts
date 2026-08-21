import "dotenv/config";
import { z } from "zod";

const optionalUrl = z.string().url().optional();
const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);
const optionalInternalToken = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(32).optional(),
);

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
  APP_TIMEZONE: z.string().default("America/Argentina/Buenos_Aires"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(8),
  PUBLIC_BASE_URL: z.string().url().default("http://127.0.0.1:3000"),
  A2A_INTERNAL_TOKEN: optionalInternalToken,
  MCP_TRANSPORT: z.enum(["stdio", "in_process"]).default("stdio"),
  DATABASE_READONLY_URL: optionalUrl,
  DATABASE_ADMIN_URL: optionalUrl,
  DATABASE_MIGRATION_URL: optionalUrl,
  LLM_PROVIDER: z.enum(["ollama", "openai", "groq"]).default("ollama"),
  OLLAMA_HOST: z.string().url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().min(1).default("qwen3:8b"),
  OPENAI_API_KEY: optionalSecret,
  OPENAI_MODEL: z.string().min(1).default("gpt-5.6"),
  GROQ_API_KEY: optionalSecret,
  GROQ_MODEL: z.string().min(1).default("openai/gpt-oss-20b"),
  LLM_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(60_000)
    .default(12_000),
  LLM_TRANSIENT_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
  LLM_CIRCUIT_FAILURE_THRESHOLD: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3),
  LLM_CIRCUIT_RESET_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(300_000)
    .default(30_000),
  SEED_ADMIN_PASSWORD: z.string().min(12).optional(),
  SEED_VIEWER_PASSWORD: z.string().min(12).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
