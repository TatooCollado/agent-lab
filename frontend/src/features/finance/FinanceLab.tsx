import { useState, type FormEvent } from "react";
import { TraceInspector } from "../execution-trace/TraceInspector";
import {
  runFinanceReport,
  type FinanceReportInput,
  type FinanceWorkflowResult,
} from "./api";

const periodLabels: Record<FinanceReportInput["period"], string> = {
  previous_calendar_month: "Mes calendario anterior",
  current_month: "Mes actual hasta hoy",
  last_30_days: "Últimos 30 días",
};

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(value);
}

export function FinanceLab() {
  const [period, setPeriod] = useState<FinanceReportInput["period"]>(
    "previous_calendar_month",
  );
  const [currency, setCurrency] = useState("ARS");
  const [dailyCost, setDailyCost] = useState("");
  const [replacementRate, setReplacementRate] = useState("");
  const [productivityRate, setProductivityRate] = useState("");
  const [result, setResult] = useState<FinanceWorkflowResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const valid =
    dailyCost !== "" &&
    replacementRate !== "" &&
    productivityRate !== "" &&
    Number(dailyCost) > 0 &&
    Number(replacementRate) >= 0 &&
    Number(productivityRate) >= 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setRunning(true);
    setError(null);
    try {
      setResult(
        await runFinanceReport({
          period,
          currency,
          dailyCost: Number(dailyCost),
          replacementPremiumRate: Number(replacementRate) / 100,
          productivityLossRate: Number(productivityRate) / 100,
        }),
      );
    } catch {
      setResult(null);
      setError("No se pudo completar el flujo financiero A2A.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <section className="finance-hero">
        <div>
          <span className="eyebrow">Colaboración entre agentes</span>
          <h1>
            Impacto de ausencias.
            <br />
            <em>Explicable y auditable.</em>
          </h1>
          <p>
            El agente de RR. HH. solicita un análisis al agente financiero
            mediante A2A. Finanzas consulta ausencias reales a través de MCP y
            aplica una fórmula determinista: el LLM coordina, pero no inventa
            datos ni hace la cuenta.
          </p>
        </div>
        <div className="delegation-flow" aria-label="Flujo entre agentes">
          <span>Agente RR. HH.</span>
          <i>A2A 1.0 →</i>
          <span>Agente Finanzas</span>
          <i>MCP →</i>
          <span>PostgreSQL</span>
        </div>
      </section>

      <section
        className="a2a-explanation"
        aria-labelledby="a2a-explanation-title"
      >
        <div className="a2a-explanation-heading">
          <span className="eyebrow">Cómo colaboran los agentes</span>
          <h2 id="a2a-explanation-title">Un pedido, dos responsabilidades</h2>
          <p>
            A2A transporta la tarea y el resultado entre agentes. MCP conecta al
            agente financiero con la herramienta que consulta la base de datos.
          </p>
        </div>
        <ol>
          <li>
            <span>01</span>
            <strong>RR. HH. delega</strong>
            <p>
              Envía período, moneda y supuestos como una tarea A2A estructurada.
            </p>
          </li>
          <li>
            <span>02</span>
            <strong>Finanzas consulta</strong>
            <p>
              Usa la herramienta MCP <code>list_absences</code> con acceso de
              sólo lectura.
            </p>
          </li>
          <li>
            <span>03</span>
            <strong>El backend calcula</strong>
            <p>
              TypeScript aplica una fórmula fija sobre los días de ausencia
              recuperados.
            </p>
          </li>
          <li>
            <span>04</span>
            <strong>Finanzas responde</strong>
            <p>
              Devuelve un artefacto A2A con totales, desglose y evidencia
              técnica.
            </p>
          </li>
        </ol>
      </section>

      <div className="workspace-grid finance-workspace">
        <section className="panel finance-input">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Parámetros del escenario</span>
              <h2>Supuestos financieros</h2>
            </div>
            <span className="readonly-pill">Sin valores ocultos</span>
          </div>
          <form onSubmit={(event) => void submit(event)}>
            <label htmlFor="finance-period">Período analizado</label>
            <select
              id="finance-period"
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as FinanceReportInput["period"])
              }
            >
              {Object.entries(periodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <div className="finance-fields">
              <div>
                <label htmlFor="currency">Moneda</label>
                <input
                  id="currency"
                  maxLength={3}
                  value={currency}
                  onChange={(event) =>
                    setCurrency(event.target.value.toUpperCase())
                  }
                  required
                />
              </div>
              <div>
                <label htmlFor="daily-cost">Costo diario por empleado</label>
                <input
                  id="daily-cost"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={dailyCost}
                  onChange={(event) => setDailyCost(event.target.value)}
                  placeholder="Obligatorio"
                  required
                />
                <small>Remuneración y cargas asociadas a un día laboral.</small>
              </div>
              <div>
                <label htmlFor="replacement-rate">
                  Recargo por reemplazo %
                </label>
                <input
                  id="replacement-rate"
                  type="number"
                  min="0"
                  max="200"
                  step="0.01"
                  value={replacementRate}
                  onChange={(event) => setReplacementRate(event.target.value)}
                  placeholder="Obligatorio"
                  required
                />
                <small>
                  Horas extra, suplencias o reasignación para cubrir la
                  ausencia.
                </small>
              </div>
              <div>
                <label htmlFor="productivity-rate">
                  Impacto de productividad %
                </label>
                <input
                  id="productivity-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={productivityRate}
                  onChange={(event) => setProductivityRate(event.target.value)}
                  placeholder="Obligatorio"
                  required
                />
                <small>Estimación del trabajo demorado o no recuperado.</small>
              </div>
            </div>

            <div className="formula-explainer">
              <span>Fórmula controlada</span>
              <strong>
                días ausentes × costo diario × (1 + recargo de reemplazo +
                impacto de productividad)
              </strong>
              <p>
                Los porcentajes se aplican sobre el costo base de la ausencia.
                No son porcentajes acumulativos entre sí.
              </p>
            </div>

            <button className="run-button" disabled={!valid || running}>
              {running
                ? "Delegando tarea A2A…"
                : "Generar informe con datos reales"}
              <span>A2A → MCP</span>
            </button>
            {error && (
              <p className="query-error" role="alert">
                {error}
              </p>
            )}
          </form>

          {result && (
            <section
              className="finance-report"
              aria-labelledby="finance-result-title"
            >
              <span className="eyebrow">
                Artefacto A2A · <code>{result.delegation.artifactName}</code>
              </span>
              <h3 id="finance-result-title">
                {formatMoney(
                  result.report.totals.totalEstimatedLoss,
                  result.report.assumptions.currency,
                )}
              </h3>
              <p>
                Impacto total estimado · {result.report.absenceDays} día(s) de
                ausencia · {result.report.affectedEmployees} empleado(s)
                afectado(s)
              </p>

              <div className="calculation-proof">
                <h4>Cómo se obtuvo el resultado</h4>
                <div>
                  <span>1. Costo base de ausencias</span>
                  <code>
                    {result.report.absenceDays} ×{" "}
                    {formatMoney(
                      result.report.assumptions.dailyCost,
                      result.report.assumptions.currency,
                    )}{" "}
                    ={" "}
                    {formatMoney(
                      result.report.totals.paidAbsenceCost,
                      result.report.assumptions.currency,
                    )}
                  </code>
                </div>
                <div>
                  <span>2. Costo de reemplazo</span>
                  <code>
                    {formatMoney(
                      result.report.totals.paidAbsenceCost,
                      result.report.assumptions.currency,
                    )}{" "}
                    ×{" "}
                    {formatPercent(
                      result.report.assumptions.replacementPremiumRate,
                    )}{" "}
                    ={" "}
                    {formatMoney(
                      result.report.totals.replacementPremiumCost,
                      result.report.assumptions.currency,
                    )}
                  </code>
                </div>
                <div>
                  <span>3. Pérdida de productividad</span>
                  <code>
                    {formatMoney(
                      result.report.totals.paidAbsenceCost,
                      result.report.assumptions.currency,
                    )}{" "}
                    ×{" "}
                    {formatPercent(
                      result.report.assumptions.productivityLossRate,
                    )}{" "}
                    ={" "}
                    {formatMoney(
                      result.report.totals.productivityLossCost,
                      result.report.assumptions.currency,
                    )}
                  </code>
                </div>
                <div className="calculation-total">
                  <span>4. Impacto total</span>
                  <code>
                    base + reemplazo + productividad ={" "}
                    {formatMoney(
                      result.report.totals.totalEstimatedLoss,
                      result.report.assumptions.currency,
                    )}
                  </code>
                </div>
              </div>

              <div className="report-metrics">
                <span>
                  Ausencia remunerada
                  <b>
                    {formatMoney(
                      result.report.totals.paidAbsenceCost,
                      result.report.assumptions.currency,
                    )}
                  </b>
                </span>
                <span>
                  Cobertura o reemplazo
                  <b>
                    {formatMoney(
                      result.report.totals.replacementPremiumCost,
                      result.report.assumptions.currency,
                    )}
                  </b>
                </span>
                <span>
                  Productividad
                  <b>
                    {formatMoney(
                      result.report.totals.productivityLossCost,
                      result.report.assumptions.currency,
                    )}
                  </b>
                </span>
              </div>

              <div className="a2a-proof">
                <h4>Evidencia de la interacción A2A</h4>
                <dl>
                  <div>
                    <dt>Agente solicitante</dt>
                    <dd>Agente de RR. HH.</dd>
                  </div>
                  <div>
                    <dt>Agente responsable</dt>
                    <dd>Agente financiero de ausencias</dd>
                  </div>
                  <div>
                    <dt>Protocolo</dt>
                    <dd>
                      {result.delegation.protocol}{" "}
                      {result.delegation.protocolVersion} ·{" "}
                      {result.delegation.transport}
                    </dd>
                  </div>
                  <div>
                    <dt>ID de tarea</dt>
                    <dd>
                      <code>{result.delegation.taskId}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Artefacto devuelto</dt>
                    <dd>
                      <code>{result.delegation.artifactName}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Fuente de datos</dt>
                    <dd>PostgreSQL · consulta MCP de sólo lectura</dd>
                  </div>
                </dl>
              </div>

              <h4 className="breakdown-title">Desglose por empleado</h4>
              {result.report.breakdown.map((item) => (
                <div className="report-row" key={item.employeeNumber}>
                  <span>
                    {item.fullName}
                    <small>
                      {item.employeeNumber} · {item.departmentCode}
                    </small>
                  </span>
                  <code>{item.absenceDays} día(s)</code>
                  <b>
                    {formatMoney(
                      item.totalEstimatedLoss,
                      result.report.assumptions.currency,
                    )}
                  </b>
                </div>
              ))}
            </section>
          )}
        </section>
        <TraceInspector events={result?.trace ?? []} />
      </div>
    </>
  );
}
