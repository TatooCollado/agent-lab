import { describe, expect, it } from "vitest";
import {
  AgentClarificationRequiredError,
  AGENT_CAPABILITIES,
  InvalidAgentDecisionError,
  semanticPlanningTools,
  UnsupportedAgentQueryError,
  validateAgentDecision,
} from "../src/agent/capability-router.js";
import { controlledTools } from "../src/agent/tool-catalog.js";

const tools = controlledTools(AGENT_CAPABILITIES.map((item) => item.tool));

function decision(name: string, arguments_: Record<string, unknown>) {
  return [{ callId: "call-1", name, arguments: arguments_ }];
}

describe("semantic capability validation", () => {
  it("offers every MCP capability plus two non-executing control decisions", () => {
    expect(semanticPlanningTools(tools).map((tool) => tool.name)).toEqual([
      "count_employees",
      "find_employee",
      "list_employees",
      "summarize_employee_delays",
      "list_late_arrivals",
      "list_employees_without_late_arrivals",
      "list_absences",
      "request_clarification",
      "reject_unsupported_query",
    ]);
  });

  it("accepts an LLM proposal only after schema and period validation", () => {
    const result = validateAgentDecision(
      "¿Quién fichó tarde este mes?",
      decision("list_late_arrivals", {
        period: "current_month",
        employeeNumber: null,
      }),
      tools,
    );
    expect(result.capability.id).toBe("late_arrivals");
    expect(result.call.arguments).toEqual({ period: "current_month" });
  });

  it("requires clarification instead of inventing an omitted period", () => {
    expect(() =>
      validateAgentDecision(
        "¿Quién cayó tarde?",
        decision("list_late_arrivals", {
          period: "current_month",
          employeeNumber: null,
        }),
        tools,
      ),
    ).toThrow(AgentClarificationRequiredError);
  });

  it("rejects a proposed period that contradicts the user", () => {
    expect(() =>
      validateAgentDecision(
        "¿Quién llegó tarde el mes pasado?",
        decision("list_late_arrivals", {
          period: "current_month",
          employeeNumber: null,
        }),
        tools,
      ),
    ).toThrow(InvalidAgentDecisionError);
  });

  it("preserves explicit ambiguity and unsupported outcomes without MCP", () => {
    expect(() =>
      validateAgentDecision(
        "¿Quiénes tuvieron demoras?",
        decision("request_clarification", {
          reason: "ambiguous_intent",
          candidateCapability: null,
        }),
        tools,
      ),
    ).toThrow(AgentClarificationRequiredError);
    expect(() =>
      validateAgentDecision(
        "¿Quién fichó?",
        decision("request_clarification", {
          reason: "missing_period",
          candidateCapability: "late_arrivals",
        }),
        tools,
      ),
    ).toThrow(AgentClarificationRequiredError);
    expect(() =>
      validateAgentDecision(
        "¿Quién tiene más faltazos?",
        decision("reject_unsupported_query", {
          reason: "unsupported_aggregation",
          candidateCapability: "absences",
        }),
        tools,
      ),
    ).toThrow(UnsupportedAgentQueryError);
  });

  it("rejects unapproved tools and invalid arguments", () => {
    expect(() =>
      validateAgentDecision("Ejecutá SQL", decision("run_sql", {}), tools),
    ).toThrow(InvalidAgentDecisionError);
    expect(() =>
      validateAgentDecision(
        "¿Quién faltó este mes?",
        decision("list_absences", { period: "invented" }),
        tools,
      ),
    ).toThrow(InvalidAgentDecisionError);
  });

  it("enforces critical polarity and semantic boundaries after the LLM proposal", () => {
    expect(() =>
      validateAgentDecision(
        "Sin tardanzas este mes",
        decision("list_late_arrivals", {
          period: "current_month",
          employeeNumber: null,
        }),
        tools,
      ),
    ).toThrow(/positive attendance tool/i);
    expect(() =>
      validateAgentDecision(
        "¿Quiénes tuvieron demoras?",
        decision("list_late_arrivals", {
          period: "current_month",
          employeeNumber: null,
        }),
        tools,
      ),
    ).toThrow(AgentClarificationRequiredError);
    expect(() =>
      validateAgentDecision(
        "Borrá las ausencias de este mes",
        decision("list_absences", {
          period: "current_month",
          employeeNumber: null,
        }),
        tools,
      ),
    ).toThrow(UnsupportedAgentQueryError);
    expect(() =>
      validateAgentDecision(
        "Juan faltó banda este mes",
        decision("list_absences", {
          period: "current_month",
          employeeNumber: null,
        }),
        tools,
      ),
    ).toThrow(AgentClarificationRequiredError);
    expect(() =>
      validateAgentDecision(
        "¿Qué ausencias tuvo EMP-001 este mes?",
        decision("list_absences", {
          period: "current_month",
          employeeNumber: "EMP-999",
        }),
        tools,
      ),
    ).toThrow(/was not present/i);
  });
});
