import { createDefaultAgent } from "../agent/factory.js";
import { DatabaseEvalFixtureManager } from "./fixture-manager.js";
import { runAgentEvals } from "./runner.js";

const fixtures = new DatabaseEvalFixtureManager();
const result = await runAgentEvals(createDefaultAgent(), fixtures);
const remainingFixtures = await fixtures.countRemainingFixtures();

console.info(JSON.stringify({ ...result, cleanup: { remainingFixtures } }, null, 2));
if (result.failed > 0 || remainingFixtures > 0) process.exitCode = 1;
