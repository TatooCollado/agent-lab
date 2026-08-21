import assert from "node:assert/strict";

const FRONTEND_URL = "https://agent-lab-ignac.onrender.com";
const API_URL = "https://agent-lab-api-ignac.vercel.app";

async function request(path, baseUrl = API_URL) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { accept: path === "/" ? "text/html" : "application/json" },
    signal: AbortSignal.timeout(60_000),
  });
  assert.equal(
    response.status,
    200,
    `${baseUrl}${path} returned ${response.status}`,
  );
  return response;
}

const directHealth = await (await request("/api/health")).json();
assert.equal(directHealth.status, "ok");
assert.equal(directHealth.service, "agent-lab-backend");

const system = await (await request("/api/system")).json();
assert.equal(system.stage, 10);
assert.deepEqual(system.pending, []);
assert.ok(system.components.includes("GitHub Actions"));
assert.ok(system.components.includes("Deployment smoke tests"));
assert.ok(system.components.includes("Deterministic capability routing"));
assert.ok(system.components.includes("Typed answer presentation payloads"));
assert.ok(system.components.includes("SQL set complement with NOT EXISTS"));
assert.ok(system.components.includes("Bounded LLM finalization retry"));
assert.ok(system.components.includes("LLM timeout budget"));
assert.ok(system.components.includes("Circuit breaker"));
assert.ok(
  system.components.includes("Graceful structured-response degradation"),
);

const capabilities = await (await request("/api/agent/capabilities")).json();
assert.equal(capabilities.capabilities.length, 7);

const resilience = await (await request("/api/resilience")).json();
assert.equal(resilience.policy.timeoutMs, 12_000);
assert.equal(resilience.policy.transientRetries, 1);
assert.equal(resilience.policy.circuitFailureThreshold, 3);
assert.equal(resilience.policy.finalizationFallback, "typed_answer_payload");

const proxiedHealth = await (await request("/api/health", FRONTEND_URL)).json();
assert.equal(proxiedHealth.status, "ok");
assert.equal(proxiedHealth.service, "agent-lab-backend");

const frontendHtml = await (await request("/", FRONTEND_URL)).text();
assert.match(frontendHtml, /<title>Agent Lab<\/title>/);

console.log(
  JSON.stringify({
    status: "ok",
    checks: [
      "vercel-health",
      "system-contract",
      "capability-catalog",
      "resilience-contract",
      "render-proxy",
      "frontend-html",
    ],
    stage: system.stage,
    components: system.components.length,
  }),
);
