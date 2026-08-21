import { A2A_PROTOCOL_VERSION, type AgentCard } from "@a2a-js/sdk";

const bearerSecurity = {
  internalBearer: {
    scheme: {
      $case: "httpAuthSecurityScheme" as const,
      value: {
        description: "Token bearer interno para comunicación entre servicios",
        scheme: "Bearer",
        bearerFormat: "opaque",
      },
    },
  },
};

const securityRequirements = [{ schemes: { internalBearer: { list: [] } } }];

function baseCard(name: string, description: string, url: string): AgentCard {
  return {
    name,
    description,
    supportedInterfaces: [
      {
        url,
        protocolBinding: "JSONRPC",
        tenant: "",
        protocolVersion: A2A_PROTOCOL_VERSION,
      },
    ],
    provider: { organization: "Agent Lab", url: "https://localhost.invalid" },
    version: "1.0.0",
    documentationUrl: "",
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extensions: [],
      extendedAgentCard: false,
    },
    securitySchemes: bearerSecurity,
    securityRequirements,
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json"],
    skills: [],
    signatures: [],
  };
}

export function createAgentCards(baseUrl: string): {
  hr: AgentCard;
  finance: AgentCard;
} {
  const hr = baseCard(
    "Agente de RR. HH. con grounding",
    "Responde consultas sobre empleados y asistencia mediante herramientas MCP aprobadas y PostgreSQL como fuente de verdad.",
    `${baseUrl}/a2a/hr`,
  );
  hr.skills = [
    {
      id: "grounded_hr_query",
      name: "Consulta grounded de RR. HH.",
      description:
        "Resuelve consultas sobre empleados, llegadas tarde y ausencias mediante herramientas MCP de sólo lectura.",
      tags: ["hr", "attendance", "mcp", "grounding"],
      examples: ["¿Qué empleados llegaron tarde durante el último mes?"],
      inputModes: ["text/plain"],
      outputModes: ["text/plain", "application/json"],
      securityRequirements,
    },
  ];

  const finance = baseCard(
    "Agente financiero de ausencias",
    "Calcula el impacto financiero de escenarios a partir de registros grounded de ausencias.",
    `${baseUrl}/a2a/finance`,
  );
  finance.skills = [
    {
      id: "absence_loss_report",
      name: "Informe de impacto por ausencias",
      description:
        "Consulta ausencias mediante MCP y calcula costos de ausencia remunerada, reemplazo y productividad.",
      tags: ["finance", "absence", "cost", "report"],
      examples: [
        "Calculá el impacto de las ausencias del mes pasado con supuestos de costo explícitos.",
      ],
      inputModes: ["application/json"],
      outputModes: ["text/plain", "application/json"],
      securityRequirements,
    },
  ];

  return { hr, finance };
}
