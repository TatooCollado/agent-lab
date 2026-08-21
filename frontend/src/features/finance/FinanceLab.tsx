import { useState, type FormEvent } from "react";
import { TraceInspector } from "../execution-trace/TraceInspector";
import { runFinanceReport, type FinanceReportInput, type FinanceWorkflowResult } from "./api";

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export function FinanceLab() {
  const [period, setPeriod] = useState<FinanceReportInput["period"]>("previous_calendar_month");
  const [currency, setCurrency] = useState("ARS");
  const [dailyCost, setDailyCost] = useState("");
  const [replacementRate, setReplacementRate] = useState("");
  const [productivityRate, setProductivityRate] = useState("");
  const [result, setResult] = useState<FinanceWorkflowResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const valid = dailyCost !== "" && replacementRate !== "" && productivityRate !== "" && Number(dailyCost) > 0 && Number(replacementRate) >= 0 && Number(productivityRate) >= 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setRunning(true);
    setError(null);
    try {
      setResult(await runFinanceReport({
        period,
        currency,
        dailyCost: Number(dailyCost),
        replacementPremiumRate: Number(replacementRate) / 100,
        productivityLossRate: Number(productivityRate) / 100
      }));
    } catch {
      setResult(null);
      setError("The A2A finance workflow could not complete.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <section className="finance-hero">
        <div><span className="eyebrow">Multi-agent collaboration</span><h1>Absence loss.<br /><em>Grounded and auditable.</em></h1><p>HR Agent delegates a structured task to Finance Agent through A2A. Finance queries absences through MCP and applies an explicit deterministic formula.</p></div>
        <div className="delegation-flow"><span>HR Agent</span><i>A2A 1.0</i><span>Finance Agent</span><i>MCP</i><span>Neon</span></div>
      </section>
      <div className="workspace-grid finance-workspace">
        <section className="panel finance-input">
          <div className="panel-heading"><div><span className="eyebrow">Scenario parameters</span><h2>Financial assumptions</h2></div><span className="readonly-pill">No hidden values</span></div>
          <form onSubmit={(event) => void submit(event)}>
            <label htmlFor="finance-period">Period</label>
            <select id="finance-period" value={period} onChange={(event) => setPeriod(event.target.value as FinanceReportInput["period"])}><option value="previous_calendar_month">Previous calendar month</option><option value="current_month">Current month</option><option value="last_30_days">Last 30 days</option></select>
            <div className="finance-fields">
              <div><label htmlFor="currency">Currency</label><input id="currency" maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} required /></div>
              <div><label htmlFor="daily-cost">Daily employee cost</label><input id="daily-cost" type="number" min="0.01" step="0.01" value={dailyCost} onChange={(event) => setDailyCost(event.target.value)} placeholder="Required" required /></div>
              <div><label htmlFor="replacement-rate">Replacement premium %</label><input id="replacement-rate" type="number" min="0" max="200" step="0.01" value={replacementRate} onChange={(event) => setReplacementRate(event.target.value)} placeholder="Required" required /></div>
              <div><label htmlFor="productivity-rate">Productivity impact %</label><input id="productivity-rate" type="number" min="0" max="100" step="0.01" value={productivityRate} onChange={(event) => setProductivityRate(event.target.value)} placeholder="Required" required /></div>
            </div>
            <p className="formula">Formula: days × daily cost × (1 + replacement premium + productivity impact)</p>
            <button className="run-button" disabled={!valid || running}>{running ? "Delegating A2A task…" : "Generate grounded report"}<span>A2A → MCP</span></button>
            {error && <p className="query-error" role="alert">{error}</p>}
          </form>
          {result && <section className="finance-report"><span className="eyebrow">A2A Artifact · {result.delegation.artifactName}</span><h3>{formatMoney(result.report.totals.totalEstimatedLoss, result.report.assumptions.currency)}</h3><p>Estimated total loss · {result.report.absenceDays} absence day(s) · {result.report.affectedEmployees} employee(s)</p><div className="report-metrics"><span>Paid absence <b>{formatMoney(result.report.totals.paidAbsenceCost, result.report.assumptions.currency)}</b></span><span>Replacement <b>{formatMoney(result.report.totals.replacementPremiumCost, result.report.assumptions.currency)}</b></span><span>Productivity <b>{formatMoney(result.report.totals.productivityLossCost, result.report.assumptions.currency)}</b></span></div>{result.report.breakdown.map((item) => <div className="report-row" key={item.employeeNumber}><span>{item.fullName}<small>{item.employeeNumber} · {item.departmentCode}</small></span><code>{item.absenceDays} day(s)</code><b>{formatMoney(item.totalEstimatedLoss, result.report.assumptions.currency)}</b></div>)}</section>}
        </section>
        <TraceInspector events={result?.trace ?? []} />
      </div>
    </>
  );
}
