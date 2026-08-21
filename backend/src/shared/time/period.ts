import { DateTime, IANAZone } from "luxon";
import { z } from "zod";

export const periodNameSchema = z.enum([
  "current_month",
  "previous_calendar_month",
  "last_30_days"
]);

export type PeriodName = z.infer<typeof periodNameSchema>;

export type DatePeriod = {
  name: PeriodName;
  timezone: string;
  startInclusive: string;
  endExclusive: string;
};

export function calculatePeriod(
  name: PeriodName,
  options: { now?: Date; timezone: string }
): DatePeriod {
  const { timezone } = options;

  if (!IANAZone.isValidZone(timezone)) {
    throw new Error(`Invalid IANA timezone: ${timezone}`);
  }

  const now = DateTime.fromJSDate(options.now ?? new Date(), { zone: timezone });
  const today = now.startOf("day");

  let start: DateTime;
  let end: DateTime;

  switch (name) {
    case "current_month":
      start = today.startOf("month");
      end = today.plus({ days: 1 });
      break;
    case "previous_calendar_month":
      end = today.startOf("month");
      start = end.minus({ months: 1 });
      break;
    case "last_30_days":
      start = today.minus({ days: 29 });
      end = today.plus({ days: 1 });
      break;
  }

  return {
    name,
    timezone,
    startInclusive: start.toISO({ suppressMilliseconds: true })!,
    endExclusive: end.toISO({ suppressMilliseconds: true })!
  };
}

