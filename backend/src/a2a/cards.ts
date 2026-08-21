import { A2A_PROTOCOL_VERSION, type AgentCard } from "@a2a-js/sdk";

const bearerSecurity = {
  internalBearer: {
    scheme: {
      $case: "httpAuthSecurityScheme" as const,
      value: {
        description: "Internal service-to-service bearer token",
        scheme: "Bearer",
        bearerFormat: "opaque"
      }
    }
  }
};

const securityRequirements = [{ schemes: { internalBearer: { list: [] } } }];

function baseCard(name: string, description: string, url: string): AgentCard {
  return {
    name,
    description,
    supportedInterfaces: [{
      url,
      protocolBinding: "JSONRPC",
      tenant: "",
      protocolVersion: A2A_PROTOCOL_VERSION
    }],
    provider: { organization: "Agent Lab", url: "https://localhost.invalid" },
    version: "1.0.0",
    documentationUrl: "",
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extensions: [],
      extendedAgentCard: false
    },
    securitySchemes: bearerSecurity,
    securityRequirements,
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json"],
    skills: [],
    signatures: []
  };
}

export function createAgentCards(baseUrl: string): { hr: AgentCard; finance: AgentCard } {
  const hr = baseCard(
    "HR Grounding Agent",
    "Answers employee and attendance questions using approved MCP tools and PostgreSQL as source of truth.",
    `${baseUrl}/a2a/hr`
  );
  hr.skills = [{
    id: "grounded_hr_query",
    name: "Grounded HR query",
    description: "Resolve employee, late-arrival and absence questions through MCP read-only tools.",
    tags: ["hr", "attendance", "mcp", "grounding"],
    examples: ["¿Qué empleados llegaron tarde durante el último mes?"],
    inputModes: ["text/plain"],
    outputModes: ["text/plain", "application/json"],
    securityRequirements
  }];

  const finance = baseCard(
    "Absence Finance Agent",
    "Calculates scenario-based financial impact from grounded employee absence records.",
    `${baseUrl}/a2a/finance`
  );
  finance.skills = [{
    id: "absence_loss_report",
    name: "Absence loss report",
    description: "Query absence records through MCP and calculate paid absence, replacement and productivity costs.",
    tags: ["finance", "absence", "cost", "report"],
    examples: ["Calculate last month's absence loss using explicit cost assumptions."],
    inputModes: ["application/json"],
    outputModes: ["text/plain", "application/json"],
    securityRequirements
  }];

  return { hr, finance };
}
