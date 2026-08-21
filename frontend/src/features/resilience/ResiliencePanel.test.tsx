import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResiliencePanel } from "./ResiliencePanel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ResiliencePanel", () => {
  it("renders the public policy and current circuit state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          provider: "groq",
          policy: {
            timeoutMs: 12000,
            transientRetries: 1,
            circuitFailureThreshold: 3,
            circuitResetMs: 30000,
            finalizationFallback: "typed_answer_payload",
          },
          runtime: {
            circuit: {
              state: "closed",
              failures: 0,
              failureThreshold: 3,
              resetMs: 30000,
            },
          },
          semantics: {
            timeout: "maximum duration per provider attempt",
            retry: "bounded retry for transient provider failures",
            circuitBreaker: "rejects calls while open",
            gracefulDegradation: "preserves grounded presentation",
          },
        }),
      }),
    );

    render(<ResiliencePanel />);

    expect(
      await screen.findByRole("heading", { name: "Política de resiliencia" }),
    ).toBeInTheDocument();
    expect(screen.getByText("12000 ms por intento")).toBeInTheDocument();
    expect(screen.getByText("closed")).toBeInTheDocument();
    expect(screen.getByText("typed_answer_payload")).toBeInTheDocument();
  });
});
