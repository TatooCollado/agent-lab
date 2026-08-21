export type ResilienceContract = {
  provider: string;
  policy: {
    timeoutMs: number;
    transientRetries: number;
    circuitFailureThreshold: number;
    circuitResetMs: number;
    finalizationFallback: string;
  };
  runtime: {
    state?: string;
    circuit?: {
      state: "closed" | "open" | "half_open";
      failures: number;
      failureThreshold: number;
      resetMs: number;
    };
  };
  semantics: Record<string, string>;
};

export async function getResilienceContract(): Promise<ResilienceContract> {
  const response = await fetch("/api/resilience");
  if (!response.ok) throw new Error("resilience_contract_unavailable");
  return (await response.json()) as ResilienceContract;
}
