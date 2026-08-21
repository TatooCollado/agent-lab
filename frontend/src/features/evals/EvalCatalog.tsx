import { useEffect, useState } from "react";
import { getEvalCatalog, type EvalCatalogResponse } from "./api";

export function EvalCatalog() {
  const [catalog, setCatalog] = useState<EvalCatalogResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void getEvalCatalog()
      .then(setCatalog)
      .catch(() => setFailed(true));
  }, []);

  return (
    <section className="eval-page">
      <div className="index-heading">
        <span className="eyebrow">Behavioral quality gates</span>
        <h1>Agent evaluations</h1>
        <p>
          Reproducible cases that measure grounding, empty-result behavior and
          database freshness through observable invariants.
        </p>
      </div>

      {failed ? (
        <p className="query-error" role="alert">
          The evaluation catalog is unavailable.
        </p>
      ) : !catalog ? (
        <p className="trace-empty">Loading evaluation contracts…</p>
      ) : (
        <>
          <div className="eval-runtime">
            <div>
              <span>Execution</span>
              <code>{catalog.execution}</code>
            </div>
            <div>
              <span>Isolation mode</span>
              <code>{catalog.mode}</code>
            </div>
          </div>
          <div className="eval-grid">
            {catalog.cases.map((item, index) => (
              <article key={item.id}>
                <div className="eval-card-top">
                  <span>CASE {String(index + 1).padStart(2, "0")}</span>
                  <code>{item.id}</code>
                </div>
                <h2>{item.title}</h2>
                <p className="eval-technique">{item.technique}</p>
                {item.execution && <code>{item.execution}</code>}
                <div className="eval-prompt">
                  <span>Prompt</span>
                  <p>{item.prompt}</p>
                </div>
                <div className="eval-invariants">
                  <span>Assertions</span>
                  <ul>
                    {item.invariants.map((invariant) => (
                      <li key={invariant}>{invariant}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
          <div className="eval-pipeline" aria-label="Evaluation pipeline">
            <span>Dataset / fixture</span>
            <i>→</i>
            <span>Agent + LLM</span>
            <i>→</i>
            <span>MCP + PostgreSQL</span>
            <i>→</i>
            <span>Assertions</span>
            <i>→</i>
            <span>Cleanup</span>
          </div>
        </>
      )}
    </section>
  );
}
