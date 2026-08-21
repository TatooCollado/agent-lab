import { describe, expect, it, vi } from "vitest";
import {
  ProviderResilienceError,
  ResilientProviderExecutor,
} from "../src/resilience/provider-resilience.js";

const policy = {
  timeoutMs: 50,
  transientRetries: 1,
  retryDelayMs: 0,
  circuitFailureThreshold: 2,
  circuitResetMs: 100,
};

describe("ResilientProviderExecutor", () => {
  it("retries one transient provider failure and then closes the circuit", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("upstream"), { status: 503 }),
      )
      .mockResolvedValueOnce("ok");
    const executor = new ResilientProviderExecutor(
      policy,
      () => 0,
      async () => {},
    );

    await expect(executor.execute(operation)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(executor.snapshot().circuit).toMatchObject({
      state: "closed",
      failures: 0,
    });
  });

  it("opens after the threshold and recovers through half-open", async () => {
    let now = 0;
    const executor = new ResilientProviderExecutor(
      { ...policy, transientRetries: 0 },
      () => now,
      async () => {},
    );
    const failure = () =>
      Promise.reject(Object.assign(new Error("upstream"), { status: 503 }));

    await expect(executor.execute(failure)).rejects.toMatchObject({
      code: "llm_provider_unavailable",
    });
    await expect(executor.execute(failure)).rejects.toMatchObject({
      code: "llm_provider_unavailable",
    });
    expect(executor.snapshot().circuit.state).toBe("open");
    await expect(executor.execute(async () => "blocked")).rejects.toMatchObject(
      {
        code: "llm_circuit_open",
      },
    );

    now = 100;
    await expect(executor.execute(async () => "recovered")).resolves.toBe(
      "recovered",
    );
    expect(executor.snapshot().circuit.state).toBe("closed");
  });

  it("aborts an attempt that exceeds its timeout budget", async () => {
    const executor = new ResilientProviderExecutor(
      { ...policy, timeoutMs: 5, transientRetries: 0 },
      () => 0,
      async () => {},
    );
    const neverCompletes = (signal: AbortSignal) =>
      new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      });

    await expect(executor.execute(neverCompletes)).rejects.toEqual(
      new ProviderResilienceError("llm_timeout", 504, true),
    );
  });
});
