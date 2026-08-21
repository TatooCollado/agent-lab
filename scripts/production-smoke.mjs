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
assert.equal(system.stage, 8);
assert.deepEqual(system.pending, []);
assert.ok(system.components.includes("GitHub Actions"));
assert.ok(system.components.includes("Deployment smoke tests"));

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
      "render-proxy",
      "frontend-html",
    ],
    stage: system.stage,
    components: system.components.length,
  }),
);
