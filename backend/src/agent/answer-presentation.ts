import {
  absencesOutputSchema,
  countEmployeesOutputSchema,
  findEmployeeOutputSchema,
  lateArrivalsOutputSchema,
  listEmployeesOutputSchema,
  summarizeEmployeeDelaysOutputSchema,
} from "../mcp/contracts.js";
import type { AgentToolOutput, AnswerPresentation } from "./contracts.js";

export function createAnswerPresentation(
  toolOutput: AgentToolOutput,
): AnswerPresentation {
  switch (toolOutput.name) {
    case "count_employees":
      return {
        kind: "employee_count",
        data: countEmployeesOutputSchema.parse(toolOutput.output),
      };
    case "list_employees":
      return {
        kind: "employee_directory",
        data: listEmployeesOutputSchema.parse(toolOutput.output),
      };
    case "find_employee":
      return {
        kind: "employee_search",
        data: findEmployeeOutputSchema.parse(toolOutput.output),
      };
    case "summarize_employee_delays":
      return {
        kind: "employee_delay_summary",
        data: summarizeEmployeeDelaysOutputSchema.parse(toolOutput.output),
      };
    case "list_late_arrivals":
      return {
        kind: "late_arrivals",
        data: lateArrivalsOutputSchema.parse(toolOutput.output),
      };
    case "list_absences":
      return {
        kind: "absences",
        data: absencesOutputSchema.parse(toolOutput.output),
      };
    default:
      throw new Error(
        `No deterministic presentation for tool: ${toolOutput.name}`,
      );
  }
}
