import type { Pool } from "pg";
import type { DatePeriod } from "../shared/time/period.js";

export type EmployeeDirectoryRecord = {
  employeeId: string;
  employeeNumber: string;
  fullName: string;
  departmentCode: string;
  departmentName: string;
  timezone: string;
  active: boolean;
};

export type LateArrivalRecord = {
  employeeId: string;
  employeeNumber: string;
  fullName: string;
  departmentCode: string;
  workDate: string;
  scheduledStart: string;
  actualArrival: string;
  lateMinutes: number;
};

export type AbsenceRecord = {
  employeeId: string;
  employeeNumber: string;
  fullName: string;
  departmentCode: string;
  workDate: string;
  scheduledStart: string;
  absenceReason: string | null;
};

export type LimitedResult<T> = {
  records: T[];
  total: number;
  truncated: boolean;
};

export type EmployeeCount = {
  total: number;
  active: number;
  inactive: number;
};

export interface HrRepository {
  countEmployees(): Promise<EmployeeCount>;
  findEmployees(query: string): Promise<LimitedResult<EmployeeDirectoryRecord>>;
  listLateArrivals(
    period: DatePeriod,
    employeeNumber?: string,
  ): Promise<LimitedResult<LateArrivalRecord>>;
  listAbsences(
    period: DatePeriod,
    employeeNumber?: string,
  ): Promise<LimitedResult<AbsenceRecord>>;
}

const SEARCH_LIMIT = 20;
const EVENT_LIMIT = 100;

function limitedResult<T extends { total_count: string }, U>(
  rows: T[],
  limit: number,
  map: (row: T) => U,
): LimitedResult<U> {
  const total = Number(rows[0]?.total_count ?? 0);
  return {
    records: rows.map(map),
    total,
    truncated: total > limit,
  };
}

export class PostgresHrRepository implements HrRepository {
  constructor(private readonly pool: Pool) {}

  async countEmployees(): Promise<EmployeeCount> {
    const result = await this.pool.query<{
      total: string;
      active: string;
      inactive: string;
    }>(
      `SELECT
         count(*)::text AS total,
         count(*) FILTER (WHERE active)::text AS active,
         count(*) FILTER (WHERE NOT active)::text AS inactive
       FROM hr_employee_directory`,
    );
    const row = result.rows[0];
    return {
      total: Number(row?.total ?? 0),
      active: Number(row?.active ?? 0),
      inactive: Number(row?.inactive ?? 0),
    };
  }

  async findEmployees(
    query: string,
  ): Promise<LimitedResult<EmployeeDirectoryRecord>> {
    type Row = {
      employee_id: string;
      employee_number: string;
      full_name: string;
      department_code: string;
      department_name: string;
      timezone: string;
      active: boolean;
      total_count: string;
    };

    const result = await this.pool.query<Row>(
      `SELECT
         id AS employee_id,
         employee_number,
         full_name,
         department_code,
         department_name,
         timezone,
         active,
         count(*) OVER ()::text AS total_count
       FROM hr_employee_directory
       WHERE employee_number ILIKE '%' || $1 || '%'
          OR full_name ILIKE '%' || $1 || '%'
       ORDER BY active DESC, full_name, employee_number
       LIMIT $2`,
      [query, SEARCH_LIMIT],
    );

    return limitedResult(result.rows, SEARCH_LIMIT, (row) => ({
      employeeId: row.employee_id,
      employeeNumber: row.employee_number,
      fullName: row.full_name,
      departmentCode: row.department_code,
      departmentName: row.department_name,
      timezone: row.timezone,
      active: row.active,
    }));
  }

  async listLateArrivals(
    period: DatePeriod,
    employeeNumber?: string,
  ): Promise<LimitedResult<LateArrivalRecord>> {
    type Row = {
      employee_id: string;
      employee_number: string;
      full_name: string;
      department_code: string;
      work_date: string;
      scheduled_start: string;
      actual_arrival: string;
      late_minutes: number;
      total_count: string;
    };

    const result = await this.pool.query<Row>(
      `SELECT
         employee_id,
         employee_number,
         full_name,
         department_code,
         to_char(work_date, 'YYYY-MM-DD') AS work_date,
         scheduled_start::text,
         actual_arrival::text,
         late_minutes,
         count(*) OVER ()::text AS total_count
       FROM hr_late_arrivals
       WHERE scheduled_start >= $1::timestamptz
         AND scheduled_start < $2::timestamptz
         AND ($3::text IS NULL OR employee_number = $3)
       ORDER BY scheduled_start DESC, employee_number
       LIMIT $4`,
      [
        period.startInclusive,
        period.endExclusive,
        employeeNumber ?? null,
        EVENT_LIMIT,
      ],
    );

    return limitedResult(result.rows, EVENT_LIMIT, (row) => ({
      employeeId: row.employee_id,
      employeeNumber: row.employee_number,
      fullName: row.full_name,
      departmentCode: row.department_code,
      workDate: row.work_date,
      scheduledStart: row.scheduled_start,
      actualArrival: row.actual_arrival,
      lateMinutes: row.late_minutes,
    }));
  }

  async listAbsences(
    period: DatePeriod,
    employeeNumber?: string,
  ): Promise<LimitedResult<AbsenceRecord>> {
    type Row = {
      employee_id: string;
      employee_number: string;
      full_name: string;
      department_code: string;
      work_date: string;
      scheduled_start: string;
      absence_reason: string | null;
      total_count: string;
    };

    const result = await this.pool.query<Row>(
      `SELECT
         employee_id,
         employee_number,
         full_name,
         department_code,
         to_char(work_date, 'YYYY-MM-DD') AS work_date,
         scheduled_start::text,
         absence_reason,
         count(*) OVER ()::text AS total_count
       FROM hr_absences
       WHERE scheduled_start >= $1::timestamptz
         AND scheduled_start < $2::timestamptz
         AND ($3::text IS NULL OR employee_number = $3)
       ORDER BY scheduled_start DESC, employee_number
       LIMIT $4`,
      [
        period.startInclusive,
        period.endExclusive,
        employeeNumber ?? null,
        EVENT_LIMIT,
      ],
    );

    return limitedResult(result.rows, EVENT_LIMIT, (row) => ({
      employeeId: row.employee_id,
      employeeNumber: row.employee_number,
      fullName: row.full_name,
      departmentCode: row.department_code,
      workDate: row.work_date,
      scheduledStart: row.scheduled_start,
      absenceReason: row.absence_reason,
    }));
  }
}
