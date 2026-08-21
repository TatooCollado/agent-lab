import type { AgentToolDefinition } from "./contracts.js";

export type AgentCapability = {
  id: string;
  label: string;
  tool: string;
  examples: string[];
  matches: (normalizedQuestion: string) => boolean;
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const delayWords = /(demora|demoras|tardanza|tardanzas|retraso|retrasos)/;

export const AGENT_CAPABILITIES: readonly AgentCapability[] = [
  {
    id: "employee_count",
    label: "Conteo de empleados",
    tool: "count_employees",
    examples: ["¿Cuántos empleados hay?"],
    matches: (question) =>
      /(cuantos|cantidad|numero|total)\s+(de\s+)?empleados/.test(question),
  },
  {
    id: "employee_directory",
    label: "Directorio de empleados",
    tool: "list_employees",
    examples: ["¿Quiénes son los empleados?", "Mostrame la nómina"],
    matches: (question) =>
      /(quienes son (los )?empleados|lista(r|do)? (de |los )?empleados|mostra(me)? (la )?(nomina|lista de empleados)|nomina|directorio de empleados)/.test(
        question,
      ),
  },
  {
    id: "employees_without_late_arrivals",
    label: "Empleados sin llegadas tarde",
    tool: "list_employees_without_late_arrivals",
    examples: ["¿Quién no llegó tarde el último mes?"],
    matches: (question) =>
      /(no\s+(llego|llegaron)\s+tarde|sin\s+(llegadas\s+tarde|demoras|tardanzas|retrasos)|no\s+(tuvo|tuvieron)\s+(demoras|tardanzas|retrasos))/.test(
        question,
      ),
  },
  {
    id: "employee_delay_summary",
    label: "Resumen histórico de demoras",
    tool: "summarize_employee_delays",
    examples: ["Pasame las demoras totales de Bruno Silva"],
    matches: (question) =>
      delayWords.test(question) && /(total|totales|acumulad)/.test(question),
  },
  {
    id: "late_arrivals",
    label: "Llegadas tarde por período",
    tool: "list_late_arrivals",
    examples: ["¿Quién llegó tarde el último mes?"],
    matches: (question) =>
      /(llego|llegaron|llegadas?)\s+tarde/.test(question) ||
      delayWords.test(question),
  },
  {
    id: "absences",
    label: "Ausencias por período",
    tool: "list_absences",
    examples: ["¿Qué ausencias hubo este mes?"],
    matches: (question) =>
      /(ausencia|ausencias|inasistencia|inasistencias|faltas)/.test(question),
  },
  {
    id: "employee_search",
    label: "Búsqueda de empleado",
    tool: "find_employee",
    examples: ["Buscá a Ana Torres", "Buscá el legajo EMP-001"],
    matches: (question) =>
      /(busca|buscar|buscame|encontra|encontrar|empleado emp-|legajo emp-)/.test(
        question,
      ),
  },
];

export class UnsupportedAgentQueryError extends Error {
  readonly code = "unsupported_agent_query";

  constructor(public readonly supportedCapabilities: string[]) {
    super("The query does not match a supported agent capability");
  }
}

export function routeAgentCapability(
  question: string,
  availableTools: AgentToolDefinition[],
): { capability: AgentCapability; tools: AgentToolDefinition[] } {
  const normalized = normalize(question);
  const capability = AGENT_CAPABILITIES.find((item) =>
    item.matches(normalized),
  );
  if (!capability) {
    throw new UnsupportedAgentQueryError(
      AGENT_CAPABILITIES.map((item) => item.id),
    );
  }
  const tools = availableTools.filter((tool) => tool.name === capability.tool);
  if (tools.length !== 1) {
    throw new Error(`Capability tool is unavailable: ${capability.tool}`);
  }
  return { capability, tools };
}
