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
        <span className="eyebrow">Failure containment</span>
        <h2 id="resilience-title">Resilience policy</h2>
        <p>
          Bounded failure handling around the cloud LLM. PostgreSQL remains the
          source of truth.
        </p>
      </div>
      {failed ? (
        <p>Resilience contract unavailable.</p>
      ) : !contract ? (
        <p>Loading resilience contract…</p>
      ) : (
        <div className="structured-table-wrap">
          <table className="structured-table">
            <thead>
              <tr>
                <th>Technique</th>
                <th>Configured policy</th>
                <th>Technical behavior</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Timeout budget</td>
                <td>{contract.policy.timeoutMs} ms / attempt</td>
                <td>{contract.semantics.timeout}</td>
              </tr>
              <tr>
                <td>Bounded retry</td>
                <td>{contract.policy.transientRetries} retry</td>
                <td>{contract.semantics.retry}</td>
              </tr>
              <tr>
                <td>Circuit breaker</td>
                <td>
                  {contract.policy.circuitFailureThreshold} failures /{" "}
                  {contract.policy.circuitResetMs} ms ·{" "}
                  <code>{circuitState}</code>
                </td>
                <td>{contract.semantics.circuitBreaker}</td>
              </tr>
              <tr>
                <td>Graceful degradation</td>
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
