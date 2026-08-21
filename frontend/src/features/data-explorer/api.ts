export type Department = {
  id: string;
  code: string;
  name: string;
  createdAt: string;
};

export type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  timezone: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  workDate: string;
  scheduledStart: string;
  actualArrival: string | null;
  status: "present" | "absent" | "leave";
  absenceReason: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type DataSnapshot = {
  departments: Department[];
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  policy: {
    exposedResources: string[];
    hiddenResources: string[];
    freeFormSql: false;
    attendanceLimit: number;
  };
};

export class DataExplorerError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/data-explorer${path}`, {
    credentials: "include",
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new DataExplorerError(body?.error ?? "data_explorer_failed");
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export function loadSnapshot(): Promise<DataSnapshot> {
  return request("/snapshot");
}

export type Resource = "departments" | "employees" | "attendance";

export function createRecord(resource: Resource, input: object): Promise<void> {
  return request(`/${resource}`, { method: "POST", body: JSON.stringify(input) });
}

export function updateRecord(resource: Resource, id: string, input: object): Promise<void> {
  return request(`/${resource}/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteRecord(resource: Resource, id: string): Promise<void> {
  return request(`/${resource}/${id}`, { method: "DELETE" });
}
