import { describe, expect, it } from "vitest";
import {
  AGENT_CAPABILITIES,
  routeAgentCapability,
} from "../src/agent/capability-router.js";
import { controlledTools } from "../src/agent/tool-catalog.js";

const tools = controlledTools(AGENT_CAPABILITIES.map((item) => item.tool));

describe("routeAgentCapability", () => {
  const cases = [
    ["¿Cuántos empleados hay?", "count_employees"],
    ["¿Quiénes son los empleados?", "list_employees"],
    ["Buscá a Ana Torres", "find_employee"],
    ["Pasame las demoras totales de Bruno Silva", "summarize_employee_delays"],
    ["¿Quién llegó tarde el último mes?", "list_late_arrivals"],
    [
      "¿Quién no llegó tarde el último mes?",
      "list_employees_without_late_arrivals",
    ],
    ["Empleados sin demoras este mes", "list_employees_without_late_arrivals"],
    ["¿Qué ausencias hubo este mes?", "list_absences"],
  ] as const;

  it.each(cases)("routes %s to %s", (question, expectedTool) => {
    const result = routeAgentCapability(question, tools);
    expect(result.tools.map((tool) => tool.name)).toEqual([expectedTool]);
  });

  it("rejects a query outside the catalog before invoking an LLM", () => {
    expect(() => routeAgentCapability("¿Cómo está el clima?", tools)).toThrow(
      /supported agent capability/i,
    );
  });
});
