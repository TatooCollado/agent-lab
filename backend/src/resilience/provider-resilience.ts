export const DEFAULT_RESILIENCE_POLICY = {
  timeoutMs: 12_000,
  transientRetries: 1,
  retryDelayMs: 150,
  circuitFailureThreshold: 3,
  circuitResetMs: 30_000,
} as const;

export type ResiliencePolicy = {
  timeoutMs: number;
  transientRetries: number;
  retryDelayMs: number;
  circuitFailureThreshold: number;
  circuitResetMs: number;
};

export type CircuitState = "closed" | "open" | "half_open";

export class ProviderResilienceError extends Error {
  constructor(
    public readonly code:
      | "llm_timeout"
      | "llm_rate_limited"
      | "llm_provider_unavailable"
      | "llm_circuit_open",
    public readonly httpStatus: 503 | 504,
    public readonly retryable: boolean,
  ) {
    super(code);
  }
}

function statusOf(error: unknown): number | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }
  return null;
}

function isTransientProviderFailure(error: unknown): boolean {
  if (error instanceof ProviderResilienceError) return true;
  const status = statusOf(error);
  return status === null || status === 408 || status === 429 || status >= 500;
}

export function normalizeProviderError(
  error: unknown,
): ProviderResilienceError {
  if (error instanceof ProviderResilienceError) return error;
  const status = statusOf(error);
  if (status === 429) {
    return new ProviderResilienceError("llm_rate_limited", 503, true);
  }
  if (status === 408 || status === 504) {
    return new ProviderResilienceError("llm_timeout", 504, true);
  }
  if (status === null || status >= 500) {
    return new ProviderResilienceError("llm_provider_unavailable", 503, true);
  }
  return new ProviderResilienceError("llm_provider_unavailable", 503, false);
}

function countsTowardCircuit(error: ProviderResilienceError): boolean {
  return (
    error.code === "llm_timeout" || error.code === "llm_provider_unavailable"
  );
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly threshold: number,
    private readonly resetMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      const elapsed = this.now() - (this.openedAt ?? this.now());
      if (elapsed < this.resetMs) {
        throw new ProviderResilienceError("llm_circuit_open", 503, true);
      }
      this.state = "half_open";
    }

    try {
      const result = await operation();
      this.state = "closed";
      this.failures = 0;
      this.openedAt = null;
      return result;
    } catch (error) {
      if (!isTransientProviderFailure(error)) throw error;
      const normalized = normalizeProviderError(error);
      if (countsTowardCircuit(normalized)) {
        this.failures += 1;
        if (this.state === "half_open" || this.failures >= this.threshold) {
          this.state = "open";
          this.openedAt = this.now();
        }
      }
      throw normalized;
    }
  }

  snapshot() {
    return {
      state: this.state,
      failures: this.failures,
      failureThreshold: this.threshold,
      resetMs: this.resetMs,
    };
  }
}

async function withTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new ProviderResilienceError("llm_timeout", 504, true));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class ResilientProviderExecutor {
  private readonly breaker: CircuitBreaker;

  constructor(
    private readonly policy: ResiliencePolicy = DEFAULT_RESILIENCE_POLICY,
    now: () => number = () => Date.now(),
    private readonly sleep: (durationMs: number) => Promise<void> = (
      durationMs,
    ) => new Promise((resolve) => setTimeout(resolve, durationMs)),
  ) {
    this.breaker = new CircuitBreaker(
      policy.circuitFailureThreshold,
      policy.circuitResetMs,
      now,
    );
  }

  async execute<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    return this.breaker.execute(async () => {
      let lastError: ProviderResilienceError | null = null;
      for (
        let attempt = 0;
        attempt <= this.policy.transientRetries;
        attempt += 1
      ) {
        try {
          return await withTimeout(this.policy.timeoutMs, operation);
        } catch (error) {
          if (!isTransientProviderFailure(error)) throw error;
          lastError = normalizeProviderError(error);
          const canRetry =
            lastError.retryable && attempt < this.policy.transientRetries;
          if (!canRetry) throw lastError;
          await this.sleep(this.policy.retryDelayMs * (attempt + 1));
        }
      }
      throw (
        lastError ??
        new ProviderResilienceError("llm_provider_unavailable", 503, true)
      );
    });
  }

  snapshot() {
    return { policy: this.policy, circuit: this.breaker.snapshot() };
  }
}
