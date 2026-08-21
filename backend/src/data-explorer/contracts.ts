import { z } from "zod";

const uuid = z.string().uuid();
const code = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .regex(/^[A-Za-z0-9_-]+$/)
  .transform((value) => value.toUpperCase());

export const departmentInputSchema = z.object({
  code,
  name: z.string().trim().min(2).max(100),
});

export const employeeInputSchema = z.object({
  employeeNumber: z.string().trim().min(2).max(30),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  departmentId: uuid,
  timezone: z.string().trim().min(3).max(100).default("America/Argentina/Buenos_Aires"),
  active: z.boolean().default(true),
});

export const attendanceInputSchema = z
  .object({
    employeeId: uuid,
    workDate: z.iso.date(),
    scheduledStart: z.iso.datetime({ offset: true }),
    actualArrival: z.iso.datetime({ offset: true }).nullable(),
    status: z.enum(["present", "absent", "leave"]),
    absenceReason: z.string().trim().max(500).nullable(),
    source: z.string().trim().min(2).max(100).default("manual-demo"),
  })
  .superRefine((value, context) => {
    const arrivalMatchesStatus =
      (value.status === "present" && value.actualArrival !== null) ||
      (value.status !== "present" && value.actualArrival === null);
    if (!arrivalMatchesStatus) {
      context.addIssue({
        code: "custom",
        path: ["actualArrival"],
        message: "Present requires arrival; absent or leave requires no arrival",
      });
    }
  });

export const resourceIdSchema = z.string().uuid();

export type DepartmentInput = z.infer<typeof departmentInputSchema>;
export type EmployeeInput = z.infer<typeof employeeInputSchema>;
export type AttendanceInput = z.infer<typeof attendanceInputSchema>;

export type Department = DepartmentInput & { id: string; createdAt: string };
export type Employee = EmployeeInput & {
  id: string;
  departmentCode: string;
  departmentName: string;
  createdAt: string;
  updatedAt: string;
};
export type AttendanceRecord = AttendanceInput & {
  id: string;
  employeeNumber: string;
  employeeName: string;
  createdAt: string;
  updatedAt: string;
};

export type DataExplorerSnapshot = {
  departments: Department[];
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  policy: {
    exposedResources: ["departments", "employees", "attendance_records"];
    hiddenResources: ["app_users", "app_sessions", "audit_events"];
    freeFormSql: false;
    attendanceLimit: number;
  };
};
