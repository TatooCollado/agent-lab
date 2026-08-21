import { McpServer } from "@modelcontextprotocol/server";
import type { HrRepository } from "../repositories/hr-repository.js";
import {
  absencesOutputSchema,
  countEmployeesInputSchema,
  countEmployeesOutputSchema,
  employeesWithoutLateArrivalsOutputSchema,
  findEmployeeInputSchema,
  findEmployeeOutputSchema,
  lateArrivalsOutputSchema,
  listEmployeesInputSchema,
  listEmployeesOutputSchema,
  periodOnlyInputSchema,
  periodInputSchema,
  summarizeEmployeeDelaysInputSchema,
  summarizeEmployeeDelaysOutputSchema,
} from "./contracts.js";
import { HrToolService } from "./tool-service.js";

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function toolResult(output: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output) }],
    structuredContent: output,
  };
}

async function executeTool(operation: () => Promise<Record<string, unknown>>) {
  try {
    return toolResult(await operation());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("MCP tool execution failed:", message);
    return {
      content: [
        {
          type: "text" as const,
          text: "La herramienta no pudo completar la consulta solicitada.",
        },
      ],
      isError: true,
    };
  }
}

export function createHrMcpServer(
  repository: HrRepository,
  timezone: string,
): McpServer {
  const server = new McpServer(
    { name: "agent-lab-hr", version: "0.2.0" },
    { capabilities: { tools: {} } },
  );
  const service = new HrToolService(repository, timezone);

  server.registerTool(
    "count_employees",
    {
      title: "Contar empleados",
      description:
        "Cuenta la dotación completa en PostgreSQL y separa empleados activos e inactivos; no lista personas.",
      inputSchema: countEmployeesInputSchema,
      outputSchema: countEmployeesOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async () => executeTool(() => service.countEmployees()),
  );

  server.registerTool(
    "list_employees",
    {
      title: "Listar empleados",
      description:
        "Lista la nómina o directorio completo desde PostgreSQL con legajo, nombre, departamento y estado.",
      inputSchema: listEmployeesInputSchema,
      outputSchema: listEmployeesOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async () => executeTool(() => service.listEmployees()),
  );

  server.registerTool(
    "find_employee",
    {
      title: "Buscar empleado",
      description:
        "Busca empleados activos o inactivos por nombre o número en PostgreSQL.",
      inputSchema: findEmployeeInputSchema,
      outputSchema: findEmployeeOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (input) => executeTool(() => service.findEmployee(input)),
  );

  server.registerTool(
    "summarize_employee_delays",
    {
      title: "Resumir demoras de un empleado",
      description:
        "Agrega el historial completo de tardanzas de una persona por nombre o legajo y calcula ocurrencias, minutos totales, promedio y máximo; no compara personas ni filtra por período.",
      inputSchema: summarizeEmployeeDelaysInputSchema,
      outputSchema: summarizeEmployeeDelaysOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (input) => executeTool(() => service.summarizeEmployeeDelays(input)),
  );

  server.registerTool(
    "list_late_arrivals",
    {
      title: "Listar llegadas tarde",
      description:
        "Consulta eventos de ingreso posterior al horario esperado en un período calendario explícito y por legajo opcional.",
      inputSchema: periodInputSchema,
      outputSchema: lateArrivalsOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (input) => executeTool(() => service.listLateArrivals(input)),
  );

  server.registerTool(
    "list_employees_without_late_arrivals",
    {
      title: "Listar empleados sin llegadas tarde",
      description:
        "Lista empleados activos con cero llegadas tarde dentro del período explícito solicitado.",
      inputSchema: periodOnlyInputSchema,
      outputSchema: employeesWithoutLateArrivalsOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (input) =>
      executeTool(() => service.listEmployeesWithoutLateArrivals(input)),
  );

  server.registerTool(
    "list_absences",
    {
      title: "Listar ausencias",
      description:
        "Consulta eventos de ausencia o inasistencia laboral en un período calendario explícito y por legajo opcional.",
      inputSchema: periodInputSchema,
      outputSchema: absencesOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (input) => executeTool(() => service.listAbsences(input)),
  );

  return server;
}
