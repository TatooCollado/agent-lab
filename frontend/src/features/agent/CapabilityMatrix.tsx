import { useEffect, useState } from "react";
import { getAgentCapabilities, type AgentCapability } from "./api";

export function CapabilityMatrix() {
  const [capabilities, setCapabilities] = useState<AgentCapability[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void getAgentCapabilities()
      .then(setCapabilities)
      .catch(() => setFailed(true));
  }, []);

  return (
    <section className="capability-matrix" aria-labelledby="capability-title">
      <div className="index-heading">
        <span className="eyebrow">Enrutamiento semántico validado</span>
        <h2 id="capability-title">Matriz de capacidades</h2>
        <p>
          El LLM propone una decisión semántica. Antes de ejecutar MCP, el
          backend valida la capacidad, el esquema, el período y los límites de
          seguridad.
        </p>
        <ol className="semantic-contract">
          <li>
            <strong>Propuesta del LLM</strong> — 7 capacidades MCP más
            decisiones controladas de aclaración y consulta no soportada.
          </li>
          <li>
            <strong>Validación del backend</strong> — allowlist, argumentos Zod,
            consistencia temporal, polaridad y límites del negocio.
          </li>
          <li>
            <strong>Ejecución MCP</strong> — sólo una decisión validada y de
            lectura puede consultar PostgreSQL.
          </li>
        </ol>
      </div>
      {failed ? (
        <p>El catálogo de capacidades no está disponible.</p>
      ) : (
        <div className="structured-table-wrap">
          <table className="structured-table">
            <thead>
              <tr>
                <th>Capacidad</th>
                <th>Herramienta MCP</th>
                <th>Ejemplo</th>
              </tr>
            </thead>
            <tbody>
              {capabilities.map((capability) => (
                <tr key={capability.id}>
                  <td>
                    {capability.label}
                    <small>{capability.id}</small>
                  </td>
                  <td>
                    <code>{capability.tool}</code>
                  </td>
                  <td>{capability.examples[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
