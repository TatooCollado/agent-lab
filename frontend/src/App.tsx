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

const concepts = [
  ["01", "Source of Truth", "PostgreSQL · Neon"],
  ["02", "Structured Outputs", "Zod + MCP structuredContent"],
  ["03", "Tool Calling", "Groq GPT-OSS 20B · Ollama local"],
  ["04", "MCP", "Client + Server · 7 read-only tools"],
  ["05", "Grounding", "Required tool call + system prompt"],
  ["06", "Guardrails", "Allowlist + read-only database role"],
  ["07", "Observability", "Sanitized TraceEvent stream"],
  ["08", "Authentication", "Opaque sessions · HttpOnly cookie"],
  ["09", "Authorization", "RBAC · admin / viewer"],
  ["10", "A2A", "Protocol 1.0 · JSON-RPC · Task + Artifact"],
  ["11", "Agent Card", "Discovery + skills + security schemes"],
  ["12", "Deterministic Workflow", "Grounded data + controlled formula"],
  ["13", "Evaluation", "Dataset + deterministic assertions"],
  ["14", "Negative Testing", "Empty result · no hallucination"],
  ["15", "Freshness Test", "Dynamic fixture + guaranteed cleanup"],
  ["16", "Infrastructure as Code", "Render Blueprint + Vercel Config"],
  ["17", "Cloud Inference", "Groq Free Plan · GPT-OSS 20B"],
  ["18", "Public API Protection", "Helmet + IP rate limiting"],
  ["19", "Serverless Runtime", "Express → Vercel Function"],
  ["20", "Fluid Compute", "Warm instances + dynamic concurrency"],
  ["21", "Transport Selection", "MCP stdio local · in-process cloud"],
  ["22", "CI/CD", "GitHub Actions + Vercel Git integration"],
  ["23", "Quality Gates", "Typecheck + build + tests + audit"],
  ["24", "Deployment Smoke Test", "API + proxy + frontend contract"],
  ["25", "Capability Routing", "Deterministic intent → least-capability tool"],
  [
    "26",
    "Deterministic Presentation",
    "Zod answerPayload → typed React component",
  ],
  ["27", "Set Complement", "PostgreSQL NOT EXISTS · explicit negation"],
  ["28", "Controlled Retry", "Groq finalization anomaly · one bounded retry"],
];

function errorMessage(error: unknown): string {
  const code = error instanceof AgentQueryError ? error.code : "unknown_error";
  if (code === "agent_not_configured") {
    return "The configured LLM provider is unavailable.";
  }
  if (code === "invalid_agent_query") return "The question is invalid.";
  if (code === "unsupported_agent_query") {
    return "Query outside the supported capability matrix. Check System index for examples.";
  }
  if (code === "agent_execution_failed") {
    return error instanceof AgentQueryError && error.requestId
      ? `Agent execution failed · Request ID: ${error.requestId}`
      : "Agent execution failed.";
  }
  return "The agent could not complete the query.";
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
        <p>Resolving session…</p>
      </main>
    );
  }

  if (!user) return <LoginScreen onAuthenticated={setUser} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Agent Lab home">
          <span className="brand-mark">AL</span>
          <span>
            Agent Lab <small>technical workspace</small>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <button
            className={activeView === "lab" ? "active" : ""}
            onClick={() => setActiveView("lab")}
          >
            Lab
          </button>
          <button
            className={activeView === "finance" ? "active" : ""}
            onClick={() => setActiveView("finance")}
          >
            Finance
          </button>
          <button
            className={activeView === "evals" ? "active" : ""}
            onClick={() => setActiveView("evals")}
          >
            Evals
          </button>
          <button
            className={activeView === "system" ? "active" : ""}
            onClick={() => setActiveView("system")}
          >
            System index
          </button>
          {user.role === "admin" && (
            <button
              className={activeView === "admin" ? "active" : ""}
              onClick={() => setActiveView("admin")}
            >
              Admin
            </button>
          )}
        </nav>
        <div className="session-chip">
          <span>{user.username}</span>
          <code>{user.role}</code>
          <button onClick={() => void signOut()}>Sign out</button>
        </div>
        <div className="stage-badge">Stage 09 · Deterministic contracts</div>
      </header>

      <main id="top">
        {activeView === "lab" ? (
          <>
            <section className="hero">
              <div>
                <span className="eyebrow">AI systems observability</span>
                <h1>
                  Query enterprise data.
                  <br />
                  <em>Inspect every protocol.</em>
                </h1>
                <p>
                  Grounded agent execution through local LLM tool calling, MCP
                  and fresh PostgreSQL queries.
                </p>
              </div>
              <div
                className="architecture-mini"
                aria-label="Architecture preview"
              >
                <span>UI</span>
                <i>→</i>
                <span>Agent</span>
                <i>→</i>
                <span>LLM</span>
                <i>→</i>
                <span>MCP</span>
                <i>→</i>
                <span>DB</span>
              </div>
            </section>

            <div className="workspace-grid">
              <section className="panel query-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">Natural language input</span>
                    <h2>Enterprise query</h2>
                  </div>
                  <span className="readonly-pill">Read-only tools</span>
                </div>
                <label htmlFor="query">Question</label>
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
                  {running ? "Running agent…" : "Run agent"}{" "}
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
                      Deterministic grounded response
                    </span>
                    <h3 id="answer-title">Structured answer</h3>
                    <StructuredAnswer presentation={result.presentation} />
                    <details className="llm-narrative">
                      <summary>
                        LLM narrative · non-deterministic presentation
                      </summary>
                      <FormattedAnswer answer={result.answer} />
                    </details>
                    <dl>
                      <div>
                        <dt>Model</dt>
                        <dd>{result.model}</dd>
                      </div>
                      <div>
                        <dt>Tools</dt>
                        <dd>{result.toolsUsed.join(", ")}</dd>
                      </div>
                      <div>
                        <dt>Grounded</dt>
                        <dd>{String(result.grounded)}</dd>
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
              <span className="eyebrow">Applied concepts</span>
              <h1>System index</h1>
              <p>
                Implementation status and owning technology for each concept.
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
            <AgentRegistry />
          </section>
        ) : (
          <AdminPanel />
        )}
      </main>
    </div>
  );
}
