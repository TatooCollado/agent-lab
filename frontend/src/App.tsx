import { useEffect, useState, type KeyboardEvent } from "react";
import {
  AgentQueryError,
  runAgentQuery,
  type AgentQueryResponse,
} from "./features/agent/api";
import { FormattedAnswer } from "./features/agent/FormattedAnswer";
import { StructuredAnswer } from "./features/agent/StructuredAnswer";
import { CapabilityMatrix } from "./features/agent/CapabilityMatrix";
import { AdminPanel } from "./features/auth/AdminPanel";
import { currentSession, logout, type SessionUser } from "./features/auth/api";
import { LoginScreen } from "./features/auth/LoginScreen";
import { TraceInspector } from "./features/execution-trace/TraceInspector";
import { EvalCatalog } from "./features/evals/EvalCatalog";
import { AgentRegistry } from "./features/finance/AgentRegistry";
import { FinanceLab } from "./features/finance/FinanceLab";
import { ResiliencePanel } from "./features/resilience/ResiliencePanel";

const concepts = [
  ["01", "Fuente de verdad", "PostgreSQL · Neon"],
  ["02", "Salidas estructuradas", "Zod + MCP structuredContent"],
  ["03", "Uso de herramientas", "Groq GPT-OSS 20B · Ollama local"],
  ["04", "MCP", "Cliente + servidor · 7 herramientas de sólo lectura"],
  ["05", "Grounding", "Herramienta obligatoria + prompt de sistema"],
  ["06", "Guardrails", "Allowlist + rol de base de datos de sólo lectura"],
  ["07", "Observabilidad", "Flujo TraceEvent sanitizado"],
  ["08", "Autenticación", "Sesiones opacas · cookie HttpOnly"],
  ["09", "Autorización", "RBAC · administrador / consulta"],
  ["10", "A2A", "Protocolo 1.0 · JSON-RPC · tarea + artefacto"],
  ["11", "Agent Card", "Descubrimiento + habilidades + seguridad"],
  ["12", "Flujo determinista", "Datos grounded + fórmula controlada"],
  ["13", "Evaluación", "Dataset + verificaciones deterministas"],
  ["14", "Pruebas negativas", "Resultado vacío · sin alucinaciones"],
  ["15", "Prueba de frescura", "Fixture dinámico + limpieza garantizada"],
  ["16", "Infraestructura como código", "Render Blueprint + Vercel Config"],
  ["17", "Inferencia en la nube", "Plan gratuito de Groq · GPT-OSS 20B"],
  ["18", "Protección de API pública", "Helmet + rate limiting por IP"],
  ["19", "Ejecución serverless", "Express → función de Vercel"],
  ["20", "Fluid Compute", "Instancias cálidas + concurrencia dinámica"],
  ["21", "Selección de transporte", "MCP stdio local · in-process en nube"],
  ["22", "CI/CD", "GitHub Actions + integración Git de Vercel"],
  ["23", "Controles de calidad", "Tipos + build + tests + auditoría"],
  ["24", "Smoke test de despliegue", "Contrato API + proxy + frontend"],
  ["25", "Enrutamiento semántico", "Propuesta LLM → validación backend → MCP"],
  [
    "26",
    "Presentación determinista",
    "Zod answerPayload → componente React tipado",
  ],
  [
    "27",
    "Complemento de conjuntos",
    "PostgreSQL NOT EXISTS · negación explícita",
  ],
  ["28", "Reintento controlado", "Anomalía de Groq · un reintento acotado"],
  ["29", "Presupuesto de tiempo", "AbortSignal · duración máxima por intento"],
  ["30", "Circuit breaker", "Máquina de estados closed → open → half-open"],
  [
    "31",
    "Degradación controlada",
    "El answerPayload grounded sobrevive a una falla narrativa",
  ],
  ["32", "Inyección de fallas", "Falla controlada · evaluación de resiliencia"],
  ["33", "Robustez semántica", "Benchmark en español neutral y rioplatense"],
  [
    "34",
    "Validación de decisiones",
    "Allowlist + Zod + invariantes temporales",
  ],
  ["35", "Contrato de aclaración", "Ambigüedad · período faltante · sin MCP"],
  [
    "36",
    "Estabilidad entre ejecuciones",
    "Intención · herramienta · argumentos · período",
  ],
  ["37", "Comparación con baseline", "Etapa 10 antes → Etapa 11 después"],
];

function errorMessage(error: unknown): string {
  const code = error instanceof AgentQueryError ? error.code : "unknown_error";
  if (code === "agent_not_configured") {
    return "El proveedor LLM configurado no está disponible.";
  }
  if (code === "llm_timeout")
    return "El proveedor LLM superó el tiempo máximo de respuesta.";
  if (code === "llm_rate_limited")
    return "Groq alcanzó temporalmente su límite. Esperá unos segundos y volvé a intentar.";
  if (code === "llm_circuit_open")
    return "El circuit breaker del LLM está abierto. Reintentá después del período de recuperación.";
  if (code === "llm_provider_unavailable")
    return "El proveedor LLM no está disponible temporalmente.";
  if (code === "invalid_agent_query") return "La pregunta no es válida.";
  if (code === "agent_clarification_required") {
    return error instanceof AgentQueryError && error.clarification
      ? error.clarification
      : "La consulta necesita una aclaración antes de ejecutar herramientas.";
  }
  if (code === "unsupported_agent_query") {
    return "La consulta requiere una capacidad que todavía no está soportada.";
  }
  if (code === "invalid_agent_decision")
    return "El backend rechazó una decisión semántica inválida.";
  if (code === "agent_execution_failed") {
    return error instanceof AgentQueryError && error.requestId
      ? `Falló la ejecución del agente · ID de solicitud: ${error.requestId}`
      : "Falló la ejecución del agente.";
  }
  return "El agente no pudo completar la consulta.";
}

export function App() {
  const [activeView, setActiveView] = useState<
    "lab" | "finance" | "evals" | "system" | "admin"
  >("lab");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [question, setQuestion] = useState(
    "¿Qué empleados llegaron tarde durante el último mes?",
  );
  const [result, setResult] = useState<AgentQueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void currentSession()
      .then(setUser)
      .finally(() => setSessionLoading(false));
  }, []);

  async function signOut() {
    await logout();
    setUser(null);
    setActiveView("lab");
    setResult(null);
  }

  async function execute() {
    if (running || question.trim().length < 3) return;
    setRunning(true);
    setError(null);
    try {
      setResult(await runAgentQuery(question.trim()));
    } catch (caught) {
      setResult(null);
      setError(errorMessage(caught));
    } finally {
      setRunning(false);
    }
  }

  function handleShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void execute();
    }
  }

  if (sessionLoading) {
    return (
      <main className="session-loading">
        <span className="brand-mark">AL</span>
        <p>Verificando sesión…</p>
      </main>
    );
  }

  if (!user) return <LoginScreen onAuthenticated={setUser} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Inicio de Agent Lab">
          <span className="brand-mark">AL</span>
          <span>
            Agent Lab <small>demostrador técnico empresarial</small>
          </span>
        </a>
        <nav aria-label="Navegación principal">
          <button
            className={activeView === "lab" ? "active" : ""}
            onClick={() => setActiveView("lab")}
          >
            Consultas
          </button>
          <button
            className={activeView === "finance" ? "active" : ""}
            onClick={() => setActiveView("finance")}
          >
            Finanzas
          </button>
          <button
            className={activeView === "evals" ? "active" : ""}
            onClick={() => setActiveView("evals")}
          >
            Evaluaciones
          </button>
          <button
            className={activeView === "system" ? "active" : ""}
            onClick={() => setActiveView("system")}
          >
            Índice técnico
          </button>
          {user.role === "admin" && (
            <button
              className={activeView === "admin" ? "active" : ""}
              onClick={() => setActiveView("admin")}
            >
              Administración
            </button>
          )}
        </nav>
        <div className="session-chip">
          <span>{user.username}</span>
          <code>{user.role}</code>
          <button onClick={() => void signOut()}>Cerrar sesión</button>
        </div>
        <div className="stage-badge">Etapa 11 · Robustez semántica</div>
      </header>

      <main id="top">
        {activeView === "lab" ? (
          <>
            <section className="hero">
              <div>
                <span className="eyebrow">
                  Observabilidad de sistemas de IA
                </span>
                <h1>
                  Consultá datos empresariales.
                  <br />
                  <em>Inspeccioná cada decisión.</em>
                </h1>
                <p>
                  Un agente con respuestas grounded, herramientas MCP y
                  consultas actuales sobre PostgreSQL, con cada paso visible y
                  auditable.
                </p>
              </div>
              <div
                className="architecture-mini"
                aria-label="Vista previa de la arquitectura"
              >
                <span>UI</span>
                <i>→</i>
                <span>Agente</span>
                <i>→</i>
                <span>LLM</span>
                <i>→</i>
                <span>MCP</span>
                <i>→</i>
                <span>BD</span>
              </div>
            </section>

            <div className="workspace-grid">
              <section className="panel query-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">Entrada en lenguaje natural</span>
                    <h2>Consulta empresarial</h2>
                  </div>
                  <span className="readonly-pill">
                    Herramientas de sólo lectura
                  </span>
                </div>
                <label htmlFor="query">Pregunta</label>
                <textarea
                  id="query"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={handleShortcut}
                  disabled={running}
                />
                <button
                  className="run-button"
                  onClick={() => void execute()}
                  disabled={running || question.trim().length < 3}
                >
                  {running ? "Ejecutando agente…" : "Ejecutar agente"}{" "}
                  <span>Ctrl/⌘ ↵</span>
                </button>
                {error && (
                  <p className="query-error" role="alert">
                    {error}
                  </p>
                )}
                {result && (
                  <section
                    className="agent-answer"
                    aria-labelledby="answer-title"
                  >
                    <span className="eyebrow">
                      Respuesta grounded determinista
                    </span>
                    <h3 id="answer-title">Respuesta estructurada</h3>
                    <StructuredAnswer presentation={result.presentation} />
                    <details className="llm-narrative">
                      <summary>
                        Narrativa del LLM · presentación no determinista
                      </summary>
                      <FormattedAnswer answer={result.answer} />
                    </details>
                    <dl>
                      <div>
                        <dt>Modelo</dt>
                        <dd>{result.model}</dd>
                      </div>
                      <div>
                        <dt>Herramientas</dt>
                        <dd>{result.toolsUsed.join(", ")}</dd>
                      </div>
                      <div>
                        <dt>Basada en datos</dt>
                        <dd>{result.grounded ? "sí" : "no"}</dd>
                      </div>
                    </dl>
                  </section>
                )}
              </section>
              <TraceInspector events={result?.trace ?? []} />
            </div>
          </>
        ) : activeView === "finance" ? (
          <FinanceLab />
        ) : activeView === "evals" ? (
          <EvalCatalog />
        ) : activeView === "system" ? (
          <section className="system-index">
            <div className="index-heading">
              <span className="eyebrow">Tecnologías y conceptos aplicados</span>
              <h1>Índice técnico del sistema</h1>
              <p>
                Qué concepto se implementó, con qué tecnología y qué función
                cumple.
              </p>
            </div>
            <div className="concept-grid">
              {concepts.map(([number, concept, technology]) => (
                <article key={concept}>
                  <span className="concept-number">{number}</span>
                  <h2>{concept}</h2>
                  <p>{technology}</p>
                </article>
              ))}
            </div>
            <CapabilityMatrix />
            <ResiliencePanel />
            <AgentRegistry />
          </section>
        ) : (
          <AdminPanel />
        )}
      </main>
    </div>
  );
}
