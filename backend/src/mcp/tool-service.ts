import type { HrRepository } from "../repositories/hr-repository.js";
import { calculatePeriod } from "../shared/time/period.js";
import type {
  AbsencesOutput,
  CountEmployeesOutput,
  FindEmployeeInput,
  FindEmployeeOutput,
  LateArrivalsOutput,
  PeriodInput,
  SummarizeEmployeeDelaysInput,
  SummarizeEmployeeDelaysOutput,
} from "./contracts.js";

export class HrToolService {
  constructor(
    private readonly repository: HrRepository,
    private readonly timezone: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async countEmployees(): Promise<CountEmployeesOutput> {
    const queriedAt = this.now().toISOString();
    const result = await this.repository.countEmployees();
    return {
      source: "postgresql",
      queriedAt,
      count: result.total,
      total: result.total,
      truncated: false,
      active: result.active,
      inactive: result.inactive,
    };
  }

  async summarizeEmployeeDelays(
    input: SummarizeEmployeeDelaysInput,
  ): Promise<SummarizeEmployeeDelaysOutput> {
    const queriedAt = this.now().toISOString();
    const result = await this.repository.summarizeEmployeeDelays(input.query);
    return {
      source: "postgresql",
      queriedAt,
      query: input.query,
      count: result.records.length,
      total: result.total,
      truncated: result.truncated,
      records: result.records,
    };
  }

  async findEmployee(input: FindEmployeeInput): Promise<FindEmployeeOutput> {
    const queriedAt = this.now().toISOString();
    const result = await this.repository.findEmployees(input.query);
    return {
      source: "postgresql",
      queriedAt,
      query: input.query,
      count: result.records.length,
      total: result.total,
      truncated: result.truncated,
      records: result.records,
    };
  }

  async listLateArrivals(input: PeriodInput): Promise<LateArrivalsOutput> {
    const now = this.now();
    const period = calculatePeriod(input.period, {
      now,
      timezone: this.timezone,
    });
    const result = await this.repository.listLateArrivals(
      period,
      input.employeeNumber,
    );
    return {
      source: "postgresql",
      queriedAt: now.toISOString(),
      period,
      employeeNumber: input.employeeNumber ?? null,
      count: result.records.length,
      total: result.total,
      truncated: result.truncated,
      records: result.records,
    };
  }

  async listAbsences(input: PeriodInput): Promise<AbsencesOutput> {
    const now = this.now();
    const period = calculatePeriod(input.period, {
      now,
      timezone: this.timezone,
    });
    const result = await this.repository.listAbsences(
      period,
      input.employeeNumber,
    );
    return {
      source: "postgresql",
      queriedAt: now.toISOString(),
      period,
      employeeNumber: input.employeeNumber ?? null,
      count: result.records.length,
      total: result.total,
      truncated: result.truncated,
      records: result.records,
    };
  }
}
