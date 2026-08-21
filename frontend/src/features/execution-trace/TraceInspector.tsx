import type { TraceEvent } from "./types";

type TraceInspectorProps = {
  events: TraceEvent[];
};

const categoryLabels: Record<TraceEvent["category"], string> = {
  system: "sistema",
  llm: "LLM",
  agent: "agente",
  mcp: "MCP",
  database: "base de datos",
  a2a: "A2A",
  guardrail: "guardrail",
  auth: "autenticación",
};

const conceptLabels: Record<string, string> = {
  Agent: "Agente",
  "Input validation": "Validación de entrada",
  "Structured input": "Entrada estructurada",
  "Financial assumptions": "Supuestos financieros",
  "Deterministic workflow": "Flujo determinista",
  "Structured Output": "Salida estructurada",
  "Tool discovery": "Descubrimiento de herramientas",
  "Source of Truth": "Fuente de verdad",
  "Fresh query": "Consulta actualizada",
  "Agent discovery": "Descubrimiento de agentes",
  "Agent delegation": "Delegación entre agentes",
  Message: "Mensaje",
  "Task lifecycle": "Ciclo de vida de la tarea",
  Artifact: "Artefacto",
  "Structured data": "Datos estructurados",
  "Agent collaboration": "Colaboración entre agentes",
  "Deterministic presentation": "Presentación determinista",
  "Schema validation": "Validación de esquema",
  "Hallucination control": "Control de alucinaciones",
  "Least privilege": "Mínimo privilegio",
  "Semantic interpretation": "Interpretación semántica",
  "Tool calling": "Uso de herramientas",
  "Semantic routing": "Enrutamiento semántico",
  "Backend validation": "Validación del backend",
};

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="json-block">
      <span className="field-label">{label}</span>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

export function TraceInspector({ events }: TraceInspectorProps) {
  return (
    <section className="panel trace-panel" aria-labelledby="trace-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Salida técnica</span>
          <h2 id="trace-title">Traza de ejecución</h2>
        </div>
        <span className="live-indicator">
          <i /> flujo de eventos
        </span>
      </div>

      <div className="trace-list">
        {events.length === 0 && (
          <div className="trace-empty">
            Ejecutá una consulta para inspeccionar cada evento técnico del
            agente.
          </div>
        )}
        {events.map((event, index) => (
          <details
            className="trace-event"
            key={event.id}
            open={index === events.length - 1}
          >
            <summary>
              <span className={`event-status ${event.status}`} />
              <span className="event-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="event-name">{event.name}</span>
              {event.durationMs !== undefined && (
                <span className="duration">{event.durationMs} ms</span>
              )}
            </summary>
            <div className="event-body">
              <dl className="event-metadata">
                <div>
                  <dt>Tecnología</dt>
                  <dd>{event.technology}</dd>
                </div>
                <div>
                  <dt>Componente</dt>
                  <dd>{event.component}</dd>
                </div>
                <div>
                  <dt>Categoría</dt>
                  <dd>{categoryLabels[event.category]}</dd>
                </div>
              </dl>
              <div className="concepts">
                {event.concepts.map((concept) => (
                  <span key={concept}>{conceptLabels[concept] ?? concept}</span>
                ))}
              </div>
              {event.input !== undefined && (
                <JsonBlock label="Entrada" value={event.input} />
              )}
              {event.output !== undefined && (
                <JsonBlock label="Salida" value={event.output} />
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
