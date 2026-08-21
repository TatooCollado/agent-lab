import "dotenv/config";
import { z } from "zod";

const optionalUrl = z.string().url().optional();
const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);
const optionalInternalToken = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(32).optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
  APP_TIMEZONE: z.string().default("America/Argentina/Buenos_Aires"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(8),
  PUBLIC_BASE_URL: z.string().url().default("http://127.0.0.1:3000"),
  A2A_INTERNAL_TOKEN: optionalInternalToken,
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
  SEED_ADMIN_PASSWORD: z.string().min(12).optional(),
  SEED_VIEWER_PASSWORD: z.string().min(12).optional()
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
