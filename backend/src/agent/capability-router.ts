import { z } from "zod";
import {
  countEmployeesInputSchema,
  findEmployeeInputSchema,
  listEmployeesInputSchema,
  periodInputSchema,
  periodOnlyInputSchema,
  summarizeEmployeeDelaysInputSchema,
} from "../mcp/contracts.js";
import type { AgentToolCall, AgentToolDefinition } from "./contracts.js";

export type AgentCapability = {
  id: string;
  label: string;
  tool: string;
  examples: string[];
};

export const AGENT_CAPABILITIES: readonly AgentCapability[] = [
  {
    id: "employee_count",
    label: "Conteo de empleados",
    tool: "count_employees",
    examples: ["¿Cuántos empleados hay?", "¿Cuánta gente trabaja acá?"],
  },
  {
    id: "employee_directory",
    label: "Directorio de empleados",
    tool: "list_employees",
    examples: ["¿Quiénes son los empleados?", "Mostrame la nómina"],
  },
  {
    id: "employees_without_late_arrivals",
    label: "Empleados sin llegadas tarde",
    tool: "list_employees_without_late_arrivals",
    examples: [
      "¿Quién no llegó tarde el último mes?",
      "¿Quién estuvo siempre puntual este mes?",
    ],
  },
  {
    id: "employee_delay_summary",
    label: "Resumen histórico de demoras",
    tool: "summarize_employee_delays",
    examples: ["Pasame las demoras totales de Bruno Silva"],
  },
  {
    id: "late_arrivals",
    label: "Llegadas tarde por período",
    tool: "list_late_arrivals",
    examples: [
      "¿Quién llegó tarde el último mes?",
      "¿Quién fichó tarde este mes?",
    ],
  },
  {
    id: "absences",
    label: "Ausencias por período",
    tool: "list_absences",
    examples: ["¿Qué ausencias hubo este mes?", "¿Quién faltó el mes pasado?"],
  },
  {
    id: "employee_search",
    label: "Búsqueda de empleado",
    tool: "find_employee",
    examples: ["Buscá a Ana Torres", "Buscá el legajo EMP-001"],
  },
] as const;

const clarificationReasonSchema = z.enum([
  "missing_period",
  "conflicting_period",
  "ambiguous_intent",
  "ambiguous_scope",
  "missing_employee_identifier",
]);
const unsupportedReasonSchema = z.enum([
  "unsupported_capability",
  "unsupported_aggregation",
  "unsupported_frequency_claim",
  "unsupported_filter",
]);
const capabilityIdSchema = z.enum([
  "employee_count",
  "employee_directory",
  "employees_without_late_arrivals",
  "employee_delay_summary",
  "late_arrivals",
  "absences",
  "employee_search",
]);

export type ClarificationReason = z.infer<typeof clarificationReasonSchema>;
export type UnsupportedReason = z.infer<typeof unsupportedReasonSchema>;

export const SEMANTIC_CONTROL_TOOLS: readonly AgentToolDefinition[] = [
  {
    type: "function",
    name: "request_clarification",
    description:
      "Seleccioná esta decisión cuando la intención sea ambigua o falte un dato obligatorio como el período. No consulta MCP ni PostgreSQL.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: clarificationReasonSchema.options,
          description: "Motivo estructurado por el que no es seguro ejecutar.",
        },
        candidateCapability: {
          type: ["string", "null"],
          enum: [...capabilityIdSchema.options, null],
          description:
            "Capability reconocida aunque falten datos, o null si la intención es ambigua.",
        },
      },
      required: ["reason", "candidateCapability"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "reject_unsupported_query",
    description:
      "Seleccioná esta decisión cuando el pedido requiera una capability, agregación, filtro o afirmación histórica que el catálogo no puede resolver. No consulta MCP ni PostgreSQL.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: unsupportedReasonSchema.options,
          description:
            "Motivo estructurado por el que la consulta no está soportada.",
        },
        candidateCapability: {
          type: ["string", "null"],
          enum: [...capabilityIdSchema.options, null],
          description:
            "Capability más cercana, o null cuando el pedido está fuera del dominio.",
        },
      },
      required: ["reason", "candidateCapability"],
      additionalProperties: false,
    },
    strict: true,
  },
] as const;

const capabilityByTool = new Map(
  AGENT_CAPABILITIES.map((capability) => [capability.tool, capability]),
);
const toolArgumentSchemas: Record<string, z.ZodType> = {
  count_employees: countEmployeesInputSchema,
  list_employees: listEmployeesInputSchema,
  find_employee: findEmployeeInputSchema,
  summarize_employee_delays: summarizeEmployeeDelaysInputSchema,
  list_late_arrivals: periodInputSchema,
  list_employees_without_late_arrivals: periodOnlyInputSchema,
  list_absences: periodInputSchema,
};

const clarificationMessages: Record<ClarificationReason, string> = {
  missing_period:
    "Indicá el período: este mes, el mes pasado o los últimos 30 días.",
  conflicting_period:
    "La consulta contiene más de un período. Indicá cuál querés consultar.",
  ambiguous_intent:
    "Aclarame qué dato necesitás consultar para elegir la capability correcta.",
  ambiguous_scope:
    "Aclarame el alcance de expresiones como siempre, seguido o acumulado.",
  missing_employee_identifier:
    "Indicá el legajo exacto del empleado para aplicar ese filtro.",
};

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

export function periodsMentioned(question: string): string[] {
  const value = normalized(question);
  const periods = new Set<string>();
  if (/(este mes|mes corriente|lo que va del mes)/.test(value))
    periods.add("current_month");
  if (/(ultimo mes|mes pasado|mes anterior)/.test(value))
    periods.add("previous_calendar_month");
  if (/(ultimos 30 dias|30 dias anteriores)/.test(value))
    periods.add("last_30_days");
  return [...periods];
}

function proposedCandidate(call: AgentToolCall): string | null {
  const direct = capabilityByTool.get(call.name)?.id;
  if (direct) return direct;
  const candidate = call.arguments.candidateCapability;
  return typeof candidate === "string" &&
    capabilityIdSchema.safeParse(candidate).success
    ? candidate
    : null;
}

function validateSemanticBoundaries(
  question: string,
  call: AgentToolCall,
): void {
  const value = normalized(question);
  const candidate = proposedCandidate(call);
  const mentioned = periodsMentioned(question);
  if (mentioned.length > 1) {
    throw new AgentClarificationRequiredError("conflicting_period", candidate);
  }
  if (
    /(borra|borrar|elimina|eliminar|modifica|modificar|actualiza|actualizar|agrega|agregar)/.test(
      value,
    )
  ) {
    throw new UnsupportedAgentQueryError(
      AGENT_CAPABILITIES.map((item) => item.id),
      "unsupported_capability",
      candidate,
    );
  }
  if (
    /(quien|cual).*(mas|mayor).*(falta|tarde|demora|impuntual)|ranking|top\s+\d*/.test(
      value,
    )
  ) {
    throw new UnsupportedAgentQueryError(
      AGENT_CAPABILITIES.map((item) => item.id),
      "unsupported_aggregation",
      candidate,
    );
  }
  if (
    /(siempre\s+tarde|tarde\s+seguido|vive\s+(llegando|entrando|cayendo)\s+tarde)/.test(
      value,
    )
  ) {
    throw new UnsupportedAgentQueryError(
      AGENT_CAPABILITIES.map((item) => item.id),
      "unsupported_frequency_claim",
      candidate ?? "late_arrivals",
    );
  }
  const delayTerm = /(demora|demoras|retraso|retrasos)/.test(value);
  const aggregateTerm = /(total|totales|acumulad|promedio|maxim)/.test(value);
  if (delayTerm && !aggregateTerm && mentioned.length === 0) {
    throw new AgentClarificationRequiredError("ambiguous_intent", null);
  }
  const bareClockAction = /^(quien\s+)?(ficho|marco)$/.test(
    value.replace(/[^a-z0-9\s]/g, "").trim(),
  );
  const afterHoursWithoutArrival =
    /despues de hora/.test(value) &&
    !/(llego|llegaron|entro|entraron|cayo|cayeron)/.test(value);
  if (
    bareClockAction ||
    afterHoursWithoutArrival ||
    /problemas? de horario/.test(value)
  ) {
    throw new AgentClarificationRequiredError("ambiguous_intent", null);
  }
  const attendanceCapability = new Set([
    "late_arrivals",
    "employees_without_late_arrivals",
    "absences",
  ]).has(candidate ?? "");
  const startsWithPerson =
    /^\s*¿?\s*(?!(?:Quien|Quién|Que|Qué|Cual|Cuál)\b)\p{Lu}[\p{L}-]+\s+(falto|faltó|llego|llegó|entro|entró|cayo|cayó|ficho|fichó|marco|marcó)/u.test(
      question,
    );
  const namesPersonAfterPreposition =
    /\b(?:de|para)\s+\p{Lu}[\p{L}-]+\s+\p{Lu}[\p{L}-]+/u.test(question);
  const explicitEmployeeNumber = /\bEMP-[A-Z0-9-]+\b/i.test(question);
  if (
    attendanceCapability &&
    !explicitEmployeeNumber &&
    (startsWithPerson || namesPersonAfterPreposition)
  ) {
    throw new AgentClarificationRequiredError(
      "missing_employee_identifier",
      candidate,
    );
  }
}

export class UnsupportedAgentQueryError extends Error {
  readonly code = "unsupported_agent_query";
  constructor(
    public readonly supportedCapabilities: string[],
    public readonly reason: UnsupportedReason = "unsupported_capability",
    public readonly candidateCapability: string | null = null,
  ) {
    super("The query does not match a supported agent capability");
  }
}

export class AgentClarificationRequiredError extends Error {
  readonly code = "agent_clarification_required";
  constructor(
    public readonly reason: ClarificationReason,
    public readonly candidateCapability: string | null = null,
    public readonly clarification = clarificationMessages[reason],
  ) {
    super("The agent requires clarification before executing a tool");
  }
}

export class InvalidAgentDecisionError extends Error {
  readonly code = "invalid_agent_decision";
  constructor(message: string) {
    super(message);
  }
}

function parseControlDecision(call: AgentToolCall): never {
  if (call.name === "request_clarification") {
    const parsed = z
      .object({
        reason: clarificationReasonSchema,
        candidateCapability: capabilityIdSchema.nullable(),
      })
      .strict()
      .safeParse(call.arguments);
    if (!parsed.success)
      throw new InvalidAgentDecisionError("Invalid clarification decision");
    throw new AgentClarificationRequiredError(
      parsed.data.reason,
      parsed.data.candidateCapability,
    );
  }
  const parsed = z
    .object({
      reason: unsupportedReasonSchema,
      candidateCapability: capabilityIdSchema.nullable(),
    })
    .strict()
    .safeParse(call.arguments);
  if (!parsed.success)
    throw new InvalidAgentDecisionError("Invalid unsupported decision");
  throw new UnsupportedAgentQueryError(
    AGENT_CAPABILITIES.map((item) => item.id),
    parsed.data.reason,
    parsed.data.candidateCapability,
  );
}

export function semanticPlanningTools(
  availableTools: AgentToolDefinition[],
): AgentToolDefinition[] {
  return [...availableTools, ...SEMANTIC_CONTROL_TOOLS];
}

export function validateAgentDecision(
  question: string,
  calls: AgentToolCall[],
  availableTools: AgentToolDefinition[],
): { capability: AgentCapability; call: AgentToolCall } {
  if (calls.length !== 1)
    throw new InvalidAgentDecisionError(
      `Expected exactly one semantic decision, received ${calls.length}`,
    );
  const call = calls[0]!;
  validateSemanticBoundaries(question, call);
  if (
    call.name === "request_clarification" ||
    call.name === "reject_unsupported_query"
  )
    return parseControlDecision(call);

  const capability = capabilityByTool.get(call.name);
  if (!capability || !availableTools.some((tool) => tool.name === call.name)) {
    throw new InvalidAgentDecisionError(
      `Model selected an unapproved tool: ${call.name}`,
    );
  }
  const sanitizedArguments = Object.fromEntries(
    Object.entries(call.arguments).filter(([, value]) => value !== null),
  );
  const parsed = toolArgumentSchemas[call.name]?.safeParse(sanitizedArguments);
  if (!parsed?.success)
    throw new InvalidAgentDecisionError(
      `Model returned invalid arguments for ${call.name}`,
    );
  const parsedData = parsed.data as Record<string, unknown>;
  if (
    typeof parsedData.employeeNumber === "string" &&
    !normalized(question).includes(normalized(parsedData.employeeNumber))
  ) {
    throw new InvalidAgentDecisionError(
      "The proposed employee number was not present in the user query",
    );
  }

  const mentioned = periodsMentioned(question);
  const periodTools = new Set([
    "list_late_arrivals",
    "list_employees_without_late_arrivals",
    "list_absences",
  ]);
  if (periodTools.has(call.name)) {
    if (mentioned.length === 0)
      throw new AgentClarificationRequiredError(
        "missing_period",
        capability.id,
      );
    if (mentioned.length > 1)
      throw new AgentClarificationRequiredError(
        "conflicting_period",
        capability.id,
      );
    if (parsedData.period !== mentioned[0])
      throw new InvalidAgentDecisionError(
        "The proposed period does not match the period stated by the user",
      );
  }
  if (call.name === "summarize_employee_delays" && mentioned.length > 0) {
    throw new UnsupportedAgentQueryError(
      AGENT_CAPABILITIES.map((item) => item.id),
      "unsupported_filter",
    );
  }
  const value = normalized(question);
  const negativeAttendance =
    /(sin\s+(tardanzas?|demoras?|retrasos?|ingresos? tardios?)|no\s+.*(llego|llegaron|entro|entraron|cayo|cayeron|ficho|ficharon|marco|marcaron).*tarde|siempre\s+puntual|llegaron?\s+(en|a)\s+horario|nunca\s+.*tarde)/.test(
      value,
    );
  const positiveAttendance =
    !negativeAttendance &&
    /(tarde|tardanza|demora|retraso|ingreso posterior)/.test(value);
  if (negativeAttendance && call.name === "list_late_arrivals") {
    throw new InvalidAgentDecisionError(
      "A positive attendance tool cannot satisfy an explicit negative query",
    );
  }
  if (
    positiveAttendance &&
    call.name === "list_employees_without_late_arrivals"
  ) {
    throw new InvalidAgentDecisionError(
      "A negative attendance tool cannot satisfy a positive query",
    );
  }
  return { capability, call: { ...call, arguments: parsedData } };
}
