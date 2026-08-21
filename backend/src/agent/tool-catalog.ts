import type { AgentToolDefinition } from "./contracts.js";

const periodProperty = {
  type: "string",
  enum: ["current_month", "previous_calendar_month", "last_30_days"],
  description: [
    "Período calendario predefinido.",
    "Usá previous_calendar_month para 'último mes' o 'mes pasado': mes calendario anterior completo.",
    "Usá current_month para 'mes corriente' o 'este mes': desde el día 1 hasta hoy inclusive.",
    "Usá last_30_days sólo para 'últimos 30 días': ventana móvil de 30 días de calendario.",
  ].join(" "),
};

export const CONTROLLED_TOOL_CATALOG: ReadonlyMap<string, AgentToolDefinition> =
  new Map([
    [
      "count_employees",
      {
        type: "function",
        name: "count_employees",
        description:
          "Cuenta la dotación completa y devuelve total, activos e inactivos. Corresponde a preguntas sobre cantidad de empleados, personal, gente que trabaja o headcount; no lista personas.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
    [
      "find_employee",
      {
        type: "function",
        name: "find_employee",
        description:
          "Busca una persona específica por nombre o legajo y devuelve sus datos de directorio. Corresponde a buscá, encontrame, fijate si está o quién es; no lista toda la nómina ni consulta asistencia.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Nombre o número de empleado",
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
    [
      "list_employees",
      {
        type: "function",
        name: "list_employees",
        description:
          "Lista el directorio completo con legajo, nombre, departamento y estado. Corresponde a nómina, plantel, listado o identidad de todo el personal; no cuenta eventos de asistencia.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
    [
      "summarize_employee_delays",
      {
        type: "function",
        name: "summarize_employee_delays",
        description:
          "Agrega el historial completo de tardanzas o impuntualidad de una persona buscada por nombre o legajo. Devuelve ocurrencias, minutos totales, promedio y máximo. Es para acumulados históricos individuales, no para listar eventos por período ni comparar personas.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Nombre o número de empleado, por ejemplo Bruno Silva",
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
    [
      "list_late_arrivals",
      {
        type: "function",
        name: "list_late_arrivals",
        description:
          "Lista eventos de ingreso posteriores al horario esperado dentro de un período explícito. Comprende llegar, entrar, caer, fichar o marcar tarde cuando el contexto laboral sea claro. No calcula rankings ni afirmaciones como 'siempre'.",
        parameters: {
          type: "object",
          properties: {
            period: periodProperty,
            employeeNumber: {
              type: ["string", "null"],
              description: "Número exacto de empleado o null",
            },
          },
          required: ["period", "employeeNumber"],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
    [
      "list_employees_without_late_arrivals",
      {
        type: "function",
        name: "list_employees_without_late_arrivals",
        description:
          "Lista empleados activos con cero llegadas tarde dentro de un período explícito. Corresponde a 'sin tardanzas', 'no llegó tarde' o 'siempre puntual' únicamente cuando el período está acotado.",
        parameters: {
          type: "object",
          properties: {
            period: periodProperty,
          },
          required: ["period"],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
    [
      "list_absences",
      {
        type: "function",
        name: "list_absences",
        description:
          "Lista eventos de ausencia o inasistencia laboral dentro de un período explícito, opcionalmente por legajo. Comprende faltó, faltazo, se ausentó o no vino; no calcula rankings como 'más faltazos'.",
        parameters: {
          type: "object",
          properties: {
            period: periodProperty,
            employeeNumber: {
              type: ["string", "null"],
              description: "Número exacto de empleado o null",
            },
          },
          required: ["period", "employeeNumber"],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
  ]);

export function controlledTools(
  discoveredNames: string[],
): AgentToolDefinition[] {
  const discovered = new Set(discoveredNames);
  const tools = [...CONTROLLED_TOOL_CATALOG.values()].filter((tool) =>
    discovered.has(tool.name),
  );

  if (tools.length !== CONTROLLED_TOOL_CATALOG.size) {
    const missing = [...CONTROLLED_TOOL_CATALOG.keys()].filter(
      (name) => !discovered.has(name),
    );
    throw new Error(
      `Required MCP tools are unavailable: ${missing.join(", ")}`,
    );
  }

  return tools;
}
