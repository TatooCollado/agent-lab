import type { TraceEvent } from "./types";

type TraceInspectorProps = {
  events: TraceEvent[];
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
          <span className="eyebrow">Technical output</span>
          <h2 id="trace-title">Execution trace</h2>
        </div>
        <span className="live-indicator"><i /> event stream</span>
      </div>

      <div className="trace-list">
        {events.length === 0 && (
          <div className="trace-empty">
            Run an agent query to inspect the technical event stream.
          </div>
        )}
        {events.map((event, index) => (
          <details className="trace-event" key={event.id} open={index === events.length - 1}>
            <summary>
              <span className={`event-status ${event.status}`} />
              <span className="event-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="event-name">{event.name}</span>
              {event.durationMs !== undefined && <span className="duration">{event.durationMs} ms</span>}
            </summary>
            <div className="event-body">
              <dl className="event-metadata">
                <div><dt>Technology</dt><dd>{event.technology}</dd></div>
                <div><dt>Component</dt><dd>{event.component}</dd></div>
                <div><dt>Category</dt><dd>{event.category}</dd></div>
              </dl>
              <div className="concepts">
                {event.concepts.map((concept) => <span key={concept}>{concept}</span>)}
              </div>
              {event.input !== undefined && <JsonBlock label="Input" value={event.input} />}
              {event.output !== undefined && <JsonBlock label="Output" value={event.output} />}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
