import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("renders an empty technical trace for an authenticated viewer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          user: { id: "u1", username: "viewer", role: "viewer" },
        }),
      }),
    );
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Traza de ejecución" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ejecutá una consulta/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/¿Por qué existe este paso?/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Administración" }),
    ).not.toBeInTheDocument();
  });

  it("runs the agent and renders its grounded response and real trace", async () => {
    const fetchMock = vi.fn().mockImplementation((input: string) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          input === "/api/auth/me"
            ? {
                user: { id: "u1", username: "viewer", role: "viewer" },
              }
            : {
                requestId: "11111111-1111-4111-8111-111111111111",
                answer: "Durante el último mes:\n- **Ana Torres** llegó tarde.",
                model: "test-model",
                grounded: true,
                toolsUsed: ["list_late_arrivals"],
                presentation: {
                  kind: "late_arrivals",
                  data: {
                    source: "postgresql",
                    queriedAt: "2026-08-20T12:00:00.000Z",
                    count: 1,
                    total: 1,
                    truncated: false,
                    period: {
                      name: "previous_calendar_month",
                      timezone: "America/Argentina/Buenos_Aires",
                      startInclusive: "2026-07-01T00:00:00-03:00",
                      endExclusive: "2026-08-01T00:00:00-03:00",
                    },
                    employeeNumber: null,
                    records: [
                      {
                        employeeId: "33333333-3333-4333-8333-333333333333",
                        employeeNumber: "EMP-001",
                        fullName: "Ana Torres",
                        departmentCode: "ENG",
                        workDate: "2026-07-05",
                        scheduledStart: "2026-07-05T09:00:00-03:00",
                        actualArrival: "2026-07-05T09:18:00-03:00",
                        lateMinutes: 18,
                      },
                    ],
                  },
                },
                trace: [
                  {
                    id: "22222222-2222-4222-8222-222222222222",
                    requestId: "11111111-1111-4111-8111-111111111111",
                    timestamp: "2026-08-20T12:00:00.000Z",
                    category: "mcp",
                    name: "mcp.tool.call.completed",
                    status: "completed",
                    technology: "Model Context Protocol",
                    component: "list_late_arrivals",
                    concepts: ["MCP Tool"],
                    output: { count: 1 },
                  },
                ],
              },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await screen.findByRole("heading", { name: "Traza de ejecución" });
    fireEvent.click(screen.getByRole("button", { name: /ejecutar agente/i }));

    expect(await screen.findByText("answerPayload")).toBeInTheDocument();
    expect(screen.getAllByText("Ana Torres").length).toBeGreaterThan(0);
    expect(screen.getByText("18 min")).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "Ana Torres llegó tarde.",
    );
    expect(screen.queryByText(/\*\*Ana Torres\*\*/)).not.toBeInTheDocument();
    expect(screen.getByText("mcp.tool.call.completed")).toBeInTheDocument();
    expect(screen.getAllByText("list_late_arrivals")).toHaveLength(2);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("shows the administration view only to an admin", async () => {
    const fetchMock = vi.fn().mockImplementation((input: string) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          input === "/api/auth/me"
            ? { user: { id: "u1", username: "admin", role: "admin" } }
            : { users: [] },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Administración" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Administración" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Eliminar datos de RR. HH." }),
    ).toBeDisabled();
  });

  it("runs the finance A2A workflow only after explicit assumptions", async () => {
    const fetchMock = vi.fn().mockImplementation((input: string) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          input === "/api/auth/me"
            ? {
                user: { id: "u1", username: "viewer", role: "viewer" },
              }
            : {
                requestId: "11111111-1111-4111-8111-111111111111",
                delegation: {
                  clientAgent: "HR Grounding Agent",
                  remoteAgent: "Absence Finance Agent",
                  protocol: "A2A",
                  protocolVersion: "1.0",
                  transport: "JSONRPC",
                  taskId: "22222222-2222-4222-8222-222222222222",
                  contextId: "33333333-3333-4333-8333-333333333333",
                  artifactName: "absence-loss-report",
                },
                report: {
                  reportId: "44444444-4444-4444-8444-444444444444",
                  generatedAt: "2026-08-20T12:00:00.000Z",
                  source: "postgresql",
                  period: {
                    name: "previous_calendar_month",
                    timezone: "America/Argentina/Buenos_Aires",
                    startInclusive: "2026-07-01",
                    endExclusive: "2026-08-01",
                  },
                  assumptions: {
                    period: "previous_calendar_month",
                    currency: "ARS",
                    dailyCost: 100000,
                    replacementPremiumRate: 0.35,
                    productivityLossRate: 0.2,
                    formula: "controlled",
                  },
                  absenceDays: 1,
                  affectedEmployees: 1,
                  breakdown: [],
                  totals: {
                    paidAbsenceCost: 100000,
                    replacementPremiumCost: 35000,
                    productivityLossCost: 20000,
                    totalEstimatedLoss: 155000,
                  },
                },
                trace: [
                  {
                    id: "55555555-5555-4555-8555-555555555555",
                    requestId: "11111111-1111-4111-8111-111111111111",
                    timestamp: "2026-08-20T12:00:00.000Z",
                    category: "a2a",
                    name: "a2a.artifact.received",
                    status: "completed",
                    technology: "A2A Protocol 1.0",
                    component: "absence-loss-report",
                    concepts: ["Artifact"],
                  },
                ],
              },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Finanzas" }));
    expect(
      screen.getByRole("heading", {
        name: "Un pedido, dos responsabilidades",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/el LLM coordina/i)).toBeInTheDocument();
    expect(screen.getByText(/no provienen de Neon/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Base 35% reemplazo/i }));
    const runButton = screen.getByRole("button", {
      name: /generar informe con datos reales/i,
    });
    expect(runButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Costo diario por empleado"), {
      target: { value: "100000" },
    });
    expect(screen.getByLabelText("Recargo por reemplazo %")).toHaveValue(35);
    expect(screen.getByLabelText("Impacto de productividad %")).toHaveValue(20);
    fireEvent.click(runButton);

    expect(
      await screen.findByText(/1 día\(s\) de ausencia/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Cómo se obtuvo el resultado")).toBeInTheDocument();
    expect(
      screen.getByText("Evidencia de la interacción A2A"),
    ).toBeInTheDocument();
    expect(screen.getByText(/base \+ reemplazo \+ productividad/i)).toHaveTextContent(
      /155\.000/,
    );
    expect(screen.getByText("a2a.artifact.received")).toBeInTheDocument();
  });

  it("renders the evaluation catalog and its technical invariants", async () => {
    const fetchMock = vi.fn().mockImplementation((input: string) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          input === "/api/auth/me"
            ? {
                user: { id: "u1", username: "viewer", role: "viewer" },
              }
            : {
                execution: "npm run evals:run",
                mode: "privileged CLI with guaranteed fixture cleanup",
                cases: [
                  {
                    id: "source-of-truth-freshness",
                    title: "Fresh database update",
                    technique: "Dynamic fixture evaluation",
                    prompt:
                      "Generated at runtime with a unique employee number.",
                    invariants: ["fresh MCP query", "fixture always cleaned"],
                  },
                ],
              },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Evaluaciones" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Evaluaciones del agente" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dynamic fixture evaluation")).toBeInTheDocument();
    expect(screen.getByText("fixture always cleaned")).toBeInTheDocument();
    expect(
      screen.queryByText(/¿Por qué existe este paso?/i),
    ).not.toBeInTheDocument();
  });

  it("presents deterministic contracts and the capability matrix", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: string) =>
        Promise.resolve({
          ok: true,
          json: async () => {
            if (input === "/api/auth/me") {
              return { user: { id: "u1", username: "viewer", role: "viewer" } };
            }
            if (input === "/api/agent/capabilities") {
              return {
                capabilities: [
                  {
                    id: "employee_directory",
                    label: "Directorio de empleados",
                    tool: "list_employees",
                    examples: ["¿Quiénes son los empleados?"],
                  },
                ],
              };
            }
            if (input === "/api/resilience") {
              return {
                provider: "groq",
                policy: {
                  timeoutMs: 12000,
                  transientRetries: 1,
                  circuitFailureThreshold: 3,
                  circuitResetMs: 30000,
                  finalizationFallback: "typed_answer_payload",
                },
                runtime: {
                  circuit: {
                    state: "closed",
                    failures: 0,
                    failureThreshold: 3,
                    resetMs: 30000,
                  },
                },
                semantics: {
                  timeout: "maximum duration per provider attempt",
                  retry: "bounded retry for transient provider failures",
                  circuitBreaker: "rejects calls while open",
                  gracefulDegradation: "preserves grounded presentation",
                },
              };
            }
            return { cards: [] };
          },
        }),
      ),
    );
    render(<App />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Índice técnico" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Índice técnico del sistema",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("CI/CD")).toBeInTheDocument();
    expect(screen.getByText("Controles de calidad")).toBeInTheDocument();
    expect(screen.getByText("Smoke test de despliegue")).toBeInTheDocument();
    expect(screen.getByText("Enrutamiento semántico")).toBeInTheDocument();
    expect(screen.getByText("Presentación determinista")).toBeInTheDocument();
    expect(screen.getByText("Complemento de conjuntos")).toBeInTheDocument();
    expect(screen.getByText("Reintento controlado")).toBeInTheDocument();
    expect(screen.getAllByText("Circuit breaker")).toHaveLength(2);
    expect(screen.getAllByText("Degradación controlada")).toHaveLength(2);
    expect(
      await screen.findByRole("heading", { name: "Política de resiliencia" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("list_employees")).toBeInTheDocument();
    expect(screen.getByText("Robustez semántica")).toBeInTheDocument();
    expect(screen.getByText("Validación de decisiones")).toBeInTheDocument();
    expect(
      screen.getByText("Estabilidad entre ejecuciones"),
    ).toBeInTheDocument();
    expect(screen.getByText("API CRUD tipada")).toBeInTheDocument();
    expect(document.querySelectorAll(".concept-grid article")).toHaveLength(41);
  });

  it("shows curated data to a viewer without mutation controls", async () => {
    const fetchMock = vi.fn().mockImplementation((input: string) => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => input === "/api/auth/me"
        ? { user: { id: "u1", username: "viewer", role: "viewer" } }
        : { departments: [{ id: "d1", code: "IT", name: "Tecnología", createdAt: "2026-08-20T12:00:00.000Z" }], employees: [], attendanceRecords: [], policy: { exposedResources: [], hiddenResources: [], freeFormSql: false, attendanceLimit: 200 } },
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Datos" }));
    expect(await screen.findByRole("heading", { name: "Explorador de datos operativos" })).toBeInTheDocument();
    expect(screen.getByText("Tecnología")).toBeInTheDocument();
    expect(screen.getByText("Sólo lectura")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear registro" })).not.toBeInTheDocument();
  });

  it("gives an admin an audited CRUD editor", async () => {
    const fetchMock = vi.fn().mockImplementation((input: string, init?: RequestInit) => Promise.resolve({
      ok: true,
      status: init?.method === "POST" ? 201 : 200,
      json: async () => input === "/api/auth/me"
        ? { user: { id: "u1", username: "admin", role: "admin" } }
        : input === "/api/data-explorer/snapshot"
          ? { departments: [], employees: [], attendanceRecords: [], policy: { exposedResources: [], hiddenResources: [], freeFormSql: false, attendanceLimit: 200 } }
          : { department: { id: "d1" } },
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Datos" }));
    fireEvent.change(await screen.findByLabelText("Código"), { target: { value: "OPS" } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Operaciones" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear registro" }));
    expect(await screen.findByText("Registro creado y auditado.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/data-explorer/departments", expect.objectContaining({ method: "POST" }));
  });
});
