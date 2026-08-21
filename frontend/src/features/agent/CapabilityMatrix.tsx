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
        <span className="eyebrow">Validated semantic routing</span>
        <h2 id="capability-title">Capability matrix</h2>
        <p>
          The LLM proposes one semantic decision. The backend validates its
          capability, schema, period and safety boundaries before MCP executes.
        </p>
        <ol className="semantic-contract">
          <li>
            <strong>LLM proposal</strong> — 7 MCP capabilities plus
            clarification and unsupported control decisions.
          </li>
          <li>
            <strong>Backend validation</strong> — allowlist, Zod arguments,
            temporal consistency, polarity and business boundaries.
          </li>
          <li>
            <strong>MCP execution</strong> — only a validated read-only decision
            can query PostgreSQL.
          </li>
        </ol>
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
