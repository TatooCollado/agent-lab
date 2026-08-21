import type { Pool, PoolClient } from "pg";
import type { SessionUser } from "../auth/contracts.js";
import { createPool } from "../db/pool.js";
import type {
  AttendanceInput,
  AttendanceRecord,
  DataExplorerSnapshot,
  Department,
  DepartmentInput,
  Employee,
  EmployeeInput,
} from "./contracts.js";

export interface DataExplorerService {
  snapshot(): Promise<DataExplorerSnapshot>;
  createDepartment(input: DepartmentInput, actor: SessionUser): Promise<Department>;
  updateDepartment(id: string, input: DepartmentInput, actor: SessionUser): Promise<Department | null>;
  deleteDepartment(id: string, actor: SessionUser): Promise<boolean>;
  createEmployee(input: EmployeeInput, actor: SessionUser): Promise<Employee>;
  updateEmployee(id: string, input: EmployeeInput, actor: SessionUser): Promise<Employee | null>;
  deleteEmployee(id: string, actor: SessionUser): Promise<boolean>;
  createAttendance(input: AttendanceInput, actor: SessionUser): Promise<AttendanceRecord>;
  updateAttendance(id: string, input: AttendanceInput, actor: SessionUser): Promise<AttendanceRecord | null>;
  deleteAttendance(id: string, actor: SessionUser): Promise<boolean>;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapDepartment(row: any): Department {
  return { id: row.id, code: row.code, name: row.name, createdAt: iso(row.created_at) };
}

function mapEmployee(row: any): Employee {
  return {
    id: row.id,
    employeeNumber: row.employee_number,
    firstName: row.first_name,
    lastName: row.last_name,
    departmentId: row.department_id,
    departmentCode: row.department_code,
    departmentName: row.department_name,
    timezone: row.timezone,
    active: row.active,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapAttendance(row: any): AttendanceRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeNumber: row.employee_number,
    employeeName: row.employee_name,
    workDate: String(row.work_date).slice(0, 10),
    scheduledStart: iso(row.scheduled_start),
    actualArrival: row.actual_arrival ? iso(row.actual_arrival) : null,
    status: row.status,
    absenceReason: row.absence_reason,
    source: row.source,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

const EMPLOYEE_SELECT = `
  SELECT e.*, d.code AS department_code, d.name AS department_name
  FROM employees e JOIN departments d ON d.id = e.department_id`;
const ATTENDANCE_SELECT = `
  SELECT ar.*, e.employee_number,
         concat_ws(' ', e.first_name, e.last_name) AS employee_name
  FROM attendance_records ar JOIN employees e ON e.id = ar.employee_id`;

export class PostgresDataExplorerService implements DataExplorerService {
  private readonly readonlyPool: Pool;
  private readonly adminPool: Pool;

  constructor(readonlyPool = createPool("readonly"), adminPool = createPool("admin")) {
    this.readonlyPool = readonlyPool;
    this.adminPool = adminPool;
  }

  async snapshot(): Promise<DataExplorerSnapshot> {
    const [departments, employees, attendance] = await Promise.all([
      this.readonlyPool.query("SELECT * FROM departments ORDER BY code"),
      this.readonlyPool.query(`${EMPLOYEE_SELECT} ORDER BY e.employee_number`),
      this.readonlyPool.query(`${ATTENDANCE_SELECT} ORDER BY ar.work_date DESC, e.employee_number LIMIT 200`),
    ]);
    return {
      departments: departments.rows.map(mapDepartment),
      employees: employees.rows.map(mapEmployee),
      attendanceRecords: attendance.rows.map(mapAttendance),
      policy: {
        exposedResources: ["departments", "employees", "attendance_records"],
        hiddenResources: ["app_users", "app_sessions", "audit_events"],
        freeFormSql: false,
        attendanceLimit: 200,
      },
    };
  }

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.adminPool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private audit(client: PoolClient, actor: SessionUser, action: string, targetType: string, targetId: string, metadata: object) {
    return client.query(
      `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [actor.id, action, targetType, targetId, JSON.stringify(metadata)],
    );
  }

  async createDepartment(input: DepartmentInput, actor: SessionUser): Promise<Department> {
    return this.transaction(async (client) => {
      const result = await client.query(
        "INSERT INTO departments (code, name) VALUES ($1, $2) RETURNING *",
        [input.code, input.name],
      );
      const item = mapDepartment(result.rows[0]);
      await this.audit(client, actor, "department.created", "department", item.id, input);
      return item;
    });
  }

  async updateDepartment(id: string, input: DepartmentInput, actor: SessionUser): Promise<Department | null> {
    return this.transaction(async (client) => {
      const result = await client.query(
        "UPDATE departments SET code = $2, name = $3 WHERE id = $1 RETURNING *",
        [id, input.code, input.name],
      );
      if (!result.rows[0]) return null;
      const item = mapDepartment(result.rows[0]);
      await this.audit(client, actor, "department.updated", "department", id, input);
      return item;
    });
  }

  async deleteDepartment(id: string, actor: SessionUser): Promise<boolean> {
    return this.transaction(async (client) => {
      const result = await client.query("DELETE FROM departments WHERE id = $1 RETURNING code", [id]);
      if (!result.rows[0]) return false;
      await this.audit(client, actor, "department.deleted", "department", id, { code: result.rows[0].code });
      return true;
    });
  }

  async createEmployee(input: EmployeeInput, actor: SessionUser): Promise<Employee> {
    return this.transaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO employees (employee_number, first_name, last_name, department_id, timezone, active)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [input.employeeNumber, input.firstName, input.lastName, input.departmentId, input.timezone, input.active],
      );
      const result = await client.query(`${EMPLOYEE_SELECT} WHERE e.id = $1`, [inserted.rows[0].id]);
      const item = mapEmployee(result.rows[0]);
      await this.audit(client, actor, "employee.created", "employee", item.id, input);
      return item;
    });
  }

  async updateEmployee(id: string, input: EmployeeInput, actor: SessionUser): Promise<Employee | null> {
    return this.transaction(async (client) => {
      const updated = await client.query(
        `UPDATE employees SET employee_number = $2, first_name = $3, last_name = $4,
         department_id = $5, timezone = $6, active = $7, updated_at = now()
         WHERE id = $1 RETURNING id`,
        [id, input.employeeNumber, input.firstName, input.lastName, input.departmentId, input.timezone, input.active],
      );
      if (!updated.rows[0]) return null;
      const result = await client.query(`${EMPLOYEE_SELECT} WHERE e.id = $1`, [id]);
      const item = mapEmployee(result.rows[0]);
      await this.audit(client, actor, "employee.updated", "employee", id, input);
      return item;
    });
  }

  async deleteEmployee(id: string, actor: SessionUser): Promise<boolean> {
    return this.transaction(async (client) => {
      const result = await client.query("DELETE FROM employees WHERE id = $1 RETURNING employee_number", [id]);
      if (!result.rows[0]) return false;
      await this.audit(client, actor, "employee.deleted", "employee", id, { employeeNumber: result.rows[0].employee_number });
      return true;
    });
  }

  async createAttendance(input: AttendanceInput, actor: SessionUser): Promise<AttendanceRecord> {
    return this.transaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO attendance_records
         (employee_id, work_date, scheduled_start, actual_arrival, status, absence_reason, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [input.employeeId, input.workDate, input.scheduledStart, input.actualArrival, input.status, input.absenceReason, input.source],
      );
      const result = await client.query(`${ATTENDANCE_SELECT} WHERE ar.id = $1`, [inserted.rows[0].id]);
      const item = mapAttendance(result.rows[0]);
      await this.audit(client, actor, "attendance.created", "attendance_record", item.id, input);
      return item;
    });
  }

  async updateAttendance(id: string, input: AttendanceInput, actor: SessionUser): Promise<AttendanceRecord | null> {
    return this.transaction(async (client) => {
      const updated = await client.query(
        `UPDATE attendance_records SET employee_id = $2, work_date = $3, scheduled_start = $4,
         actual_arrival = $5, status = $6, absence_reason = $7, source = $8, updated_at = now()
         WHERE id = $1 RETURNING id`,
        [id, input.employeeId, input.workDate, input.scheduledStart, input.actualArrival, input.status, input.absenceReason, input.source],
      );
      if (!updated.rows[0]) return null;
      const result = await client.query(`${ATTENDANCE_SELECT} WHERE ar.id = $1`, [id]);
      const item = mapAttendance(result.rows[0]);
      await this.audit(client, actor, "attendance.updated", "attendance_record", id, input);
      return item;
    });
  }

  async deleteAttendance(id: string, actor: SessionUser): Promise<boolean> {
    return this.transaction(async (client) => {
      const result = await client.query("DELETE FROM attendance_records WHERE id = $1 RETURNING work_date", [id]);
      if (!result.rows[0]) return false;
      await this.audit(client, actor, "attendance.deleted", "attendance_record", id, { workDate: String(result.rows[0].work_date).slice(0, 10) });
      return true;
    });
  }
}
