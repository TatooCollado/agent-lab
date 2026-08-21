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
          "Cuenta todos los empleados y devuelve total, activos e inactivos. Usala para preguntas globales como '¿cuántos empleados hay?'.",
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
        description: "Busca empleados por nombre o número de empleado.",
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
        "Lista todos los empleados con legajo, nombre, departamento y estado. Usala para preguntas como '¿quiénes son los empleados?' o 'mostrame la nómina'.",
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
        "Calcula las demoras o tardanzas totales históricas de un empleado buscado por nombre o legajo. Devuelve cantidad de llegadas tarde, minutos totales, promedio y máximo.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Nombre o número de empleado, por ejemplo Bruno Silva",
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
        description: "Lista llegadas tarde por período y empleado opcional.",
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
      "list_absences",
      {
        type: "function",
        name: "list_absences",
        description: "Lista ausencias por período y empleado opcional.",
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
