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
        <span className="eyebrow">Controles de calidad del comportamiento</span>
        <h1>Evaluaciones del agente</h1>
        <p>
          Casos reproducibles que miden grounding, resultados vacíos y frescura
          de la base de datos mediante invariantes observables.
        </p>
      </div>

      {failed ? (
        <p className="query-error" role="alert">
          El catálogo de evaluaciones no está disponible.
        </p>
      ) : !catalog ? (
        <p className="trace-empty">Cargando contratos de evaluación…</p>
      ) : (
        <>
          <div className="eval-runtime">
            <div>
              <span>Ejecución</span>
              <code>{catalog.execution}</code>
            </div>
            <div>
              <span>Modo de aislamiento</span>
              <code>{catalog.mode}</code>
            </div>
          </div>
          <div className="eval-grid">
            {catalog.cases.map((item, index) => (
              <article key={item.id}>
                <div className="eval-card-top">
                  <span>CASO {String(index + 1).padStart(2, "0")}</span>
                  <code>{item.id}</code>
                </div>
                <h2>{item.title}</h2>
                <p className="eval-technique">{item.technique}</p>
                {item.execution && <code>{item.execution}</code>}
                <div className="eval-prompt">
                  <span>Consulta</span>
                  <p>{item.prompt}</p>
                </div>
                <div className="eval-invariants">
                  <span>Verificaciones</span>
                  <ul>
                    {item.invariants.map((invariant) => (
                      <li key={invariant}>{invariant}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
          <div className="eval-pipeline" aria-label="Flujo de evaluación">
            <span>Dataset / fixture</span>
            <i>→</i>
            <span>Agente + LLM</span>
            <i>→</i>
            <span>MCP + PostgreSQL</span>
            <i>→</i>
            <span>Verificaciones</span>
            <i>→</i>
            <span>Limpieza</span>
          </div>
        </>
      )}
    </section>
  );
}
