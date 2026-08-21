import { rateLimit } from "express-rate-limit";

function handler(error: string) {
  return (_request: unknown, response: { status(code: number): { json(body: unknown): void } }) => {
    response.status(429).json({ error });
  };
}

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: handler("login_rate_limit_exceeded")
});

export const agentRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: handler("agent_rate_limit_exceeded")
});
