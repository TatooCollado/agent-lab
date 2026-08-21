export type EvalCase = {
  id: string;
  title: string;
  technique: string;
  prompt: string;
  invariants: string[];
};

export type EvalCatalogResponse = {
  cases: EvalCase[];
  execution: string;
  mode: string;
};

export async function getEvalCatalog(): Promise<EvalCatalogResponse> {
  const response = await fetch("/api/evals/catalog", { credentials: "include" });
  if (!response.ok) throw new Error("eval_catalog_unavailable");
  return (await response.json()) as EvalCatalogResponse;
}
