import { useEffect, useState } from "react";
import { getAgentCards, type AgentCard } from "./api";

export function AgentRegistry() {
  const [cards, setCards] = useState<AgentCard[]>([]);

  useEffect(() => {
    void getAgentCards()
      .then(setCards)
      .catch(() => setCards([]));
  }, []);

  return (
    <section className="agent-registry" aria-labelledby="registry-title">
      <div>
        <span className="eyebrow">Descubrimiento A2A</span>
        <h2 id="registry-title">Tarjetas de agentes</h2>
      </div>
      <div className="agent-card-grid">
        {cards.map((card) => (
          <article key={card.name}>
            <div className="agent-card-top">
              <span>TARJETA DE AGENTE</span>
              <code>v{card.version}</code>
            </div>
            <h3>{card.name}</h3>
            <p>{card.description}</p>
            <dl>
              <div>
                <dt>Protocolo</dt>
                <dd>
                  {card.supportedInterfaces[0]?.protocolBinding} ·{" "}
                  {card.supportedInterfaces[0]?.protocolVersion}
                </dd>
              </div>
              <div>
                <dt>Habilidades</dt>
                <dd>{card.skills.map((skill) => skill.id).join(", ")}</dd>
              </div>
              <div>
                <dt>Etiquetas</dt>
                <dd>
                  {card.skills.flatMap((skill) => skill.tags).join(" · ")}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
