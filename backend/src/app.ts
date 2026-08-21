import cors from "cors";
import express from "express";
import * as helmetModule from "helmet";
import { randomUUID } from "node:crypto";
import { loadEnv } from "./config/env.js";
import { calculatePeriod, periodNameSchema } from "./shared/time/period.js";
import { agentAnswerSchema, agentQuerySchema } from "./agent/contracts.js";
import { createDefaultAgent } from "./agent/factory.js";
import {
  AGENT_CAPABILITIES,
  AgentClarificationRequiredError,
  InvalidAgentDecisionError,
  UnsupportedAgentQueryError,
} from "./agent/capability-router.js";
import type { AgentRunner } from "./agent/orchestrator.js";
import {
  clearHrDataSchema,
  createUserSchema,
  loginSchema,
  type SessionUser,
} from "./auth/contracts.js";
import { DatabaseAuthService, type AuthService } from "./auth/service.js";
import { registerA2aRuntime } from "./a2a/runtime.js";
import type { FinanceCoordinator } from "./a2a/finance-client.js";
import { financeReportInputSchema } from "./finance/contracts.js";
import { EVAL_CATALOG } from "./evals/catalog.js";
import { agentRateLimit, loginRateLimit } from "./security/rate-limits.js";
import { ProviderResilienceError } from "./resilience/provider-resilience.js";

const SESSION_COOKIE = "agent_lab_session";
const createHelmet =
  helmetModule.default as unknown as () => express.RequestHandler;

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
  }
  return null;
}

export function createApp(
  options: {
    agent?: AgentRunner;
    auth?: AuthService;
    financeCoordinator?: FinanceCoordinator;
  } = {},
) {
  const env = loadEnv();
  const app = express();
  const auth = options.auth ?? new DatabaseAuthService(env.SESSION_TTL_HOURS);
  let defaultAgent: AgentRunner | null = null;
  const getAgent = () =>
    options.agent ?? (defaultAgent ??= createDefaultAgent());
  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: env.NODE_ENV === "production",
    path: "/",
  };

  app.disable("x-powered-by");
  if (env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.use(createHelmet());
  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "32kb" }));
  app.use((req, res, next) => {
    const requestId = req.header("x-request-id") ?? randomUUID();
    res.setHeader("x-request-id", requestId);
    res.locals.requestId = requestId;
    next();
  });

  const a2a = env.A2A_INTERNAL_TOKEN
    ? registerA2aRuntime(app, env.PUBLIC_BASE_URL, env.A2A_INTERNAL_TOKEN)
    : null;

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "agent-lab-backend",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/system", (_req, res) => {
    res.json({
      stage: 11,
      timezone: env.APP_TIMEZONE,
      components: [
        "React",
        "Express",
        "Ollama local inference",
        "MCP Client",
        "MCP Server",
        "Purpose-built employee count tool",
        "Purpose-built employee directory tool",
        "Purpose-built employee delay aggregation tool",
        "Purpose-built negative attendance tool",
        "MCP stdio transport (local)",
        "MCP in-process transport (serverless)",
        "PostgreSQL",
        "Opaque server-side sessions",
        "RBAC",
        "A2A Protocol 1.0",
        "Agent Cards",
        "Deterministic finance workflow",
        "Behavioral evaluations",
        "Dynamic evaluation fixtures",
        "Grounding assertions",
        "Render Static Site",
        "Vercel Functions",
        "Fluid Compute",
        "Region-aware serverless deployment",
        "GitHub Actions",
        "CI/CD pipeline",
        "Quality gates",
        "Deployment smoke tests",
        "Vercel Git integration",
        "Groq cloud inference",
        "HTTP security headers",
        "Rate limiting",
        "Trace Contract",
        "LLM semantic proposal",
        "Backend semantic decision validation",
        "Typed clarification and unsupported outcomes",
        "Repeated-run semantic stability benchmark",
        "Typed answer presentation payloads",
        "SQL set complement with NOT EXISTS",
        "Bounded LLM finalization retry",
        "LLM timeout budget",
        "Circuit breaker",
        "Graceful structured-response degradation",
        "Controlled fault injection",
      ],
      pending: [],
    });
  });

  app.get("/api/agent/capabilities", (_req, res) => {
    res.json({
      capabilities: AGENT_CAPABILITIES.map(({ id, label, tool, examples }) => ({
        id,
        label,
        tool,
        examples,
      })),
    });
  });

  app.get("/api/resilience", (_req, res) => {
    res.json({
      provider: env.LLM_PROVIDER,
      policy: {
        timeoutMs: env.LLM_TIMEOUT_MS,
        transientRetries: env.LLM_TRANSIENT_RETRIES,
        circuitFailureThreshold: env.LLM_CIRCUIT_FAILURE_THRESHOLD,
        circuitResetMs: env.LLM_CIRCUIT_RESET_MS,
        finalizationFallback: "typed_answer_payload",
      },
      runtime: getAgent().resilienceSnapshot?.() ?? { state: "not_exposed" },
      semantics: {
        timeout: "duración máxima por intento del proveedor",
        retry: "reintento acotado ante fallas transitorias del proveedor",
        circuitBreaker:
          "rechaza llamadas al proveedor mientras el circuito está abierto",
        gracefulDegradation:
          "conserva la presentación grounded cuando sólo falla la narración final",
      },
    });
  });

  const requireSession: express.RequestHandler = async (req, res, next) => {
    try {
      const token = cookieValue(req.header("cookie"), SESSION_COOKIE);
      const user = token ? await auth.authenticate(token) : null;
      if (!token || !user) {
        res.status(401).json({ error: "authentication_required" });
        return;
      }
      res.locals.sessionToken = token;
      res.locals.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };

  const requireAdmin: express.RequestHandler = (_req, res, next) => {
    const user = res.locals.user as SessionUser;
    if (user.role !== "admin") {
      res.status(403).json({ error: "admin_required" });
      return;
    }
    next();
  };

  app.post("/api/auth/login", loginRateLimit, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_credentials_format" });
      return;
    }
    const result = await auth.login(parsed.data.username, parsed.data.password);
    if (!result) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
    res.cookie(SESSION_COOKIE, result.token, {
      ...cookieOptions,
      expires: result.expiresAt,
    });
    res.json({ user: result.user, expiresAt: result.expiresAt.toISOString() });
  });

  app.get("/api/auth/me", requireSession, (_req, res) => {
    res.json({ user: res.locals.user });
  });

  app.post("/api/auth/logout", requireSession, async (_req, res) => {
    await auth.logout(res.locals.sessionToken as string);
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.status(204).end();
  });

  app.get(
    "/api/admin/users",
    requireSession,
    requireAdmin,
    async (_req, res) => {
      res.json({ users: await auth.listUsers() });
    },
  );

  app.get("/api/agents/cards", requireSession, (_req, res) => {
    if (!a2a) {
      res.status(503).json({ error: "a2a_not_configured" });
      return;
    }
    res.json({ cards: [a2a.cards.hr, a2a.cards.finance] });
  });

  app.get("/api/evals/catalog", requireSession, (_req, res) => {
    res.json({
      cases: EVAL_CATALOG,
      execution: "npm run evals:run",
      mode: "CLI privilegiada con limpieza garantizada de fixtures",
    });
  });

  app.post(
    "/api/finance/absence-loss-report",
    agentRateLimit,
    requireSession,
    async (req, res) => {
      const parsed = financeReportInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "invalid_finance_report",
          details: parsed.error.issues,
        });
        return;
      }
      const coordinator = options.financeCoordinator ?? a2a?.financeCoordinator;
      if (!coordinator) {
        res.status(503).json({ error: "a2a_not_configured" });
        return;
      }
      try {
        res.json(
          await coordinator.run(parsed.data, res.locals.requestId as string),
        );
      } catch (error) {
        console.error("Finance A2A workflow failed", {
          requestId: res.locals.requestId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        res.status(502).json({
          error: "finance_workflow_failed",
          requestId: res.locals.requestId,
        });
      }
    },
  );

  app.post(
    "/api/admin/users",
    requireSession,
    requireAdmin,
    async (req, res) => {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "invalid_user", details: parsed.error.issues });
        return;
      }
      try {
        const user = await auth.createUser({
          actor: res.locals.user as SessionUser,
          ...parsed.data,
        });
        res.status(201).json({ user });
      } catch (error) {
        const duplicate =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "23505";
        if (!duplicate) throw error;
        res.status(409).json({ error: "username_exists" });
      }
    },
  );

  app.delete(
    "/api/admin/hr-data",
    requireSession,
    requireAdmin,
    async (req, res) => {
      const parsed = clearHrDataSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "confirmation_required" });
        return;
      }
      const deleted = await auth.clearHrData(res.locals.user as SessionUser);
      res.json({ deleted, schemaPreserved: true, usersPreserved: true });
    },
  );

  app.get("/api/periods/:name", (req, res) => {
    const parsed = periodNameSchema.safeParse(req.params.name);
    if (!parsed.success) {
      res.status(400).json({
        error: "unsupported_period",
        supported: periodNameSchema.options,
      });
      return;
    }
    res.json(calculatePeriod(parsed.data, { timezone: env.APP_TIMEZONE }));
  });

  app.post(
    "/api/agent/query",
    agentRateLimit,
    requireSession,
    async (req, res) => {
      const parsed = agentQuerySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "invalid_agent_query",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
        return;
      }

      try {
        const agent = getAgent();
        const result = await agent.run(
          parsed.data.question,
          res.locals.requestId as string,
        );
        res.json(agentAnswerSchema.parse(result));
      } catch (error) {
        if (error instanceof UnsupportedAgentQueryError) {
          res.status(422).json({
            error: error.code,
            requestId: res.locals.requestId,
            reason: error.reason,
            candidateCapability: error.candidateCapability,
            supportedCapabilities: error.supportedCapabilities,
          });
          return;
        }
        if (error instanceof AgentClarificationRequiredError) {
          res.status(422).json({
            error: error.code,
            requestId: res.locals.requestId,
            reason: error.reason,
            candidateCapability: error.candidateCapability,
            clarification: error.clarification,
          });
          return;
        }
        if (error instanceof InvalidAgentDecisionError) {
          res.status(502).json({
            error: error.code,
            requestId: res.locals.requestId,
          });
          return;
        }
        if (error instanceof ProviderResilienceError) {
          res.status(error.httpStatus).json({
            error: error.code,
            requestId: res.locals.requestId,
            retryable: error.retryable,
          });
          return;
        }
        const configurationError =
          error instanceof Error &&
          [
            "OPENAI_API_KEY is not configured",
            "GROQ_API_KEY is not configured",
          ].includes(error.message);
        console.error("Agent query failed", {
          requestId: res.locals.requestId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        res.status(configurationError ? 503 : 502).json({
          error: configurationError
            ? "agent_not_configured"
            : "agent_execution_failed",
          requestId: res.locals.requestId,
        });
      }
    },
  );

  app.use(((error, _req, res, _next) => {
    console.error("Unhandled request error", {
      requestId: res.locals.requestId ?? "unknown",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    if (!res.headersSent) {
      res.status(500).json({
        error: "internal_server_error",
        requestId: res.locals.requestId ?? "unknown",
      });
    }
  }) satisfies express.ErrorRequestHandler);

  return app;
}

let serverlessApp: ReturnType<typeof createApp> | null = null;

const serverlessHandler: express.RequestHandler = (req, res, next) => {
  serverlessApp ??= createApp();
  serverlessApp(req, res, next);
};

export default serverlessHandler;
