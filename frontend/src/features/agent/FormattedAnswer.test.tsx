import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormattedAnswer } from "./FormattedAnswer";

describe("FormattedAnswer", () => {
  it("renders GFM tables and inline formatting without raw markdown", () => {
    render(<FormattedAnswer answer={[
      "**Llegadas tarde**",
      "",
      "| Empleado | Minutos |",
      "|---|---:|",
      "| Ana Torres | 18 |",
      "",
      "*Fuente `list_late_arrivals`.*"
    ].join("\n")} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Llegadas tarde", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("list_late_arrivals", { selector: "code" })).toBeInTheDocument();
    expect(screen.queryByText(/\*\*Llegadas tarde\*\*/)).not.toBeInTheDocument();
  });
});
