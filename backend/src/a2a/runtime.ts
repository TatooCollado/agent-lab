import { timingSafeEqual } from "node:crypto";
import type express from "express";
import { DefaultRequestHandler, InMemoryTaskStore } from "@a2a-js/sdk/server";
import { agentCardHandler, jsonRpcHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import { createDefaultAgent } from "../agent/factory.js";
import { StdioMcpGateway } from "../agent/mcp-gateway.js";
import { createAgentCards } from "./cards.js";
import { FinanceAgentExecutor, HrAgentExecutor } from "./executors.js";
import { A2aFinanceCoordinator } from "./finance-client.js";

function validBearer(header: string | undefined, expected: string): boolean {
  const value = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function registerA2aRuntime(app: express.Express, baseUrl: string, token: string) {
  const cards = createAgentCards(baseUrl);
  const financeHandler = new DefaultRequestHandler(
    cards.finance,
    new InMemoryTaskStore(),
    new FinanceAgentExecutor(() => new StdioMcpGateway())
  );
  const hrHandler = new DefaultRequestHandler(
    cards.hr,
    new InMemoryTaskStore(),
    new HrAgentExecutor(() => createDefaultAgent())
  );
  const internalAuth: express.RequestHandler = (req, res, next) => {
    if (!validBearer(req.header("authorization"), token)) {
      res.status(401).json({ error: "a2a_authentication_required" });
      return;
    }
    next();
  };

  app.use("/.well-known/agent-card.json", agentCardHandler({ agentCardProvider: hrHandler }));
  app.use("/.well-known/hr-agent-card.json", agentCardHandler({ agentCardProvider: hrHandler }));
  app.use("/.well-known/finance-agent-card.json", agentCardHandler({ agentCardProvider: financeHandler }));
  app.use("/a2a/hr", internalAuth, jsonRpcHandler({ requestHandler: hrHandler, userBuilder: UserBuilder.noAuthentication }));
  app.use("/a2a/finance", internalAuth, jsonRpcHandler({ requestHandler: financeHandler, userBuilder: UserBuilder.noAuthentication }));

  return {
    cards,
    financeCoordinator: new A2aFinanceCoordinator(baseUrl, token)
  };
}
