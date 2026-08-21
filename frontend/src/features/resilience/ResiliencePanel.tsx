import { useEffect, useState } from "react";
import { getResilienceContract, type ResilienceContract } from "./api";

export function ResiliencePanel() {
  const [contract, setContract] = useState<ResilienceContract | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void getResilienceContract()
      .then(setContract)
      .catch(() => setFailed(true));
  }, []);

  const circuitState =
    contract?.runtime.circuit?.state ??
    contract?.runtime.state ??
    "unavailable";

  return (
    <section
      className="capability-matrix resilience-panel"
      aria-labelledby="resilience-title"
    >
      <div className="index-heading">
        <span className="eyebrow">Contención de fallas</span>
        <h2 id="resilience-title">Política de resiliencia</h2>
        <p>
          Manejo acotado de fallas alrededor del LLM en la nube. PostgreSQL
          continúa siendo la fuente de verdad.
        </p>
      </div>
      {failed ? (
        <p>El contrato de resiliencia no está disponible.</p>
      ) : !contract ? (
        <p>Cargando contrato de resiliencia…</p>
      ) : (
        <div className="structured-table-wrap">
          <table className="structured-table">
            <thead>
              <tr>
                <th>Técnica</th>
                <th>Política configurada</th>
                <th>Comportamiento técnico</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Tiempo máximo</td>
                <td>{contract.policy.timeoutMs} ms por intento</td>
                <td>{contract.semantics.timeout}</td>
              </tr>
              <tr>
                <td>Reintento acotado</td>
                <td>{contract.policy.transientRetries} reintento</td>
                <td>{contract.semantics.retry}</td>
              </tr>
              <tr>
                <td>Circuit breaker</td>
                <td>
                  {contract.policy.circuitFailureThreshold} fallas /{" "}
                  {contract.policy.circuitResetMs} ms ·{" "}
                  <code>{circuitState}</code>
                </td>
                <td>{contract.semantics.circuitBreaker}</td>
              </tr>
              <tr>
                <td>Degradación controlada</td>
                <td>
                  <code>{contract.policy.finalizationFallback}</code>
                </td>
                <td>{contract.semantics.gracefulDegradation}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
