export const EVAL_CATALOG = [
  {
    id: "known-late-arrivals",
    title: "Known grounded records",
    technique: "Reference-based evaluation",
    prompt: "¿Qué empleados llegaron tarde durante el último mes?",
    invariants: ["grounded=true", "tool=list_late_arrivals", "database count=2"]
  },
  {
    id: "unknown-employee",
    title: "No hallucination on empty result",
    technique: "Negative evaluation",
    prompt: "Buscá al empleado EMP-NOT-FOUND-EVAL.",
    invariants: ["grounded=true", "tool=find_employee", "database count=0", "explicit no-result answer"]
  },
  {
    id: "source-of-truth-freshness",
    title: "Fresh database update",
    technique: "Dynamic fixture evaluation",
    prompt: "Generated at runtime with a unique employee number.",
    invariants: ["temporary record inserted", "fresh MCP query", "database count=1", "fixture always cleaned"]
  }
] as const;
