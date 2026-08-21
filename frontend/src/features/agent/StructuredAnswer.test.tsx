import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StructuredAnswer } from "./StructuredAnswer";

afterEach(cleanup);

const metadata = {
  source: "postgresql" as const,
  queriedAt: "2026-08-20T12:00:00.000Z",
  count: 1,
  total: 1,
  truncated: false,
};

describe("StructuredAnswer", () => {
  it("renders employee delay metrics from the typed payload, not prose", () => {
    render(
      <StructuredAnswer
        presentation={{
          kind: "employee_delay_summary",
          data: {
            ...metadata,
            query: "Bruno Silva",
            records: [
              {
                employeeId: "11111111-1111-4111-8111-111111111111",
                employeeNumber: "EMP-002",
                fullName: "Bruno Silva",
                departmentCode: "OPS",
                occurrences: 1,
                totalLateMinutes: 42,
                averageLateMinutes: 42,
                maximumLateMinutes: 42,
                firstOccurrenceDate: "2026-07-10",
                lastOccurrenceDate: "2026-07-10",
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText("employee_delay_summary")).toBeInTheDocument();
    expect(screen.getAllByText("42 min")).toHaveLength(3);
    expect(screen.getByText("2026-07-10 → 2026-07-10")).toBeInTheDocument();
  });

  it("renders an explicit deterministic empty state", () => {
    render(
      <StructuredAnswer
        presentation={{
          kind: "employee_search",
          data: {
            ...metadata,
            count: 0,
            total: 0,
            query: "Missing",
            records: [],
          },
        }}
      />,
    );

    expect(
      screen.getByText("No se encontraron registros para la consulta."),
    ).toBeInTheDocument();
  });

  it("renders employees produced by the set-complement payload", () => {
    render(
      <StructuredAnswer
        presentation={{
          kind: "employees_without_late_arrivals",
          data: {
            ...metadata,
            period: {
              name: "previous_calendar_month",
              timezone: "America/Argentina/Buenos_Aires",
              startInclusive: "2026-07-01T00:00:00-03:00",
              endExclusive: "2026-08-01T00:00:00-03:00",
            },
            records: [
              {
                employeeId: "11111111-1111-4111-8111-111111111113",
                employeeNumber: "EMP-003",
                fullName: "Carla Méndez",
                departmentCode: "FIN",
                departmentName: "Finance",
                timezone: "America/Argentina/Buenos_Aires",
                active: true,
              },
            ],
          },
        }}
      />,
    );

    expect(
      screen.getByText("employees_without_late_arrivals"),
    ).toBeInTheDocument();
    expect(screen.getByText("Carla Méndez")).toBeInTheDocument();
    expect(screen.getByText("EMP-003")).toBeInTheDocument();
  });
});
