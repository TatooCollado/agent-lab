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
        <span className="eyebrow">Deterministic routing</span>
        <h2 id="capability-title">Capability matrix</h2>
        <p>
          Each supported intent narrows the LLM to one least-capability MCP
          tool.
        </p>
      </div>
      {failed ? (
        <p>Capability catalog unavailable.</p>
      ) : (
        <div className="structured-table-wrap">
          <table className="structured-table">
            <thead>
              <tr>
                <th>Capability</th>
                <th>MCP tool</th>
                <th>Example</th>
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
