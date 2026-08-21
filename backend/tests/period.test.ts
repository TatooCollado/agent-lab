import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { calculatePeriod } from "../src/shared/time/period.js";

const timezone = "America/Argentina/Buenos_Aires";

function instant(localIso: string): Date {
  return DateTime.fromISO(localIso, { zone: timezone }).toJSDate();
}

describe("calculatePeriod", () => {
  it("uses day 1 through today inclusive for current_month", () => {
    const period = calculatePeriod("current_month", {
      now: instant("2026-08-15T14:30:00"),
      timezone
    });

    expect(period.startInclusive).toBe("2026-08-01T00:00:00-03:00");
    expect(period.endExclusive).toBe("2026-08-16T00:00:00-03:00");
  });

  it("returns the complete previous calendar month", () => {
    const period = calculatePeriod("previous_calendar_month", {
      now: instant("2026-08-15T14:30:00"),
      timezone
    });

    expect(period.startInclusive).toBe("2026-07-01T00:00:00-03:00");
    expect(period.endExclusive).toBe("2026-08-01T00:00:00-03:00");
  });

  it("handles February in a leap year without manual day counts", () => {
    const period = calculatePeriod("previous_calendar_month", {
      now: instant("2024-03-10T09:00:00"),
      timezone
    });

    expect(period.startInclusive).toBe("2024-02-01T00:00:00-03:00");
    expect(period.endExclusive).toBe("2024-03-01T00:00:00-03:00");
  });

  it("defines last_30_days as today plus the previous 29 calendar days", () => {
    const period = calculatePeriod("last_30_days", {
      now: instant("2026-08-15T14:30:00"),
      timezone
    });

    expect(period.startInclusive).toBe("2026-07-17T00:00:00-03:00");
    expect(period.endExclusive).toBe("2026-08-16T00:00:00-03:00");
  });
});

