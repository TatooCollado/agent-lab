import { useEffect, useState, type FormEvent } from "react";
import type { UserRole } from "../auth/api";
import {
  createRecord,
  DataExplorerError,
  deleteRecord,
  loadSnapshot,
  updateRecord,
  type AttendanceRecord,
  type DataSnapshot,
  type Department,
  type Employee,
  type Resource,
} from "./api";

type Tab = "departments" | "employees" | "attendance";

const tabLabels: Record<Tab, string> = {
  departments: "Departamentos",
  employees: "Empleados",
  attendance: "Asistencia",
};

function localDateTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function mutationMessage(error: unknown): string {
  const code = error instanceof DataExplorerError ? error.code : "unknown";
  if (code === "resource_already_exists") return "Ya existe un registro con esos datos únicos.";
  if (code === "resource_in_use_or_reference_invalid")
    return "La relación indicada no existe o el registro todavía está siendo utilizado.";
  if (code === "invalid_resource") return "Revisá los campos: hay datos inválidos o inconsistentes.";
  return "No se pudo completar la operación sobre la base de datos.";
}

export function DataExplorer({ role }: { role: UserRole }) {
  const [tab, setTab] = useState<Tab>("departments");
  const [snapshot, setSnapshot] = useState<DataSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Department | Employee | AttendanceRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canWrite = role === "admin";

  async function refresh() {
    setSnapshot(await loadSnapshot());
  }

  useEffect(() => {
    void refresh()
      .catch(() => setError("No se pudieron leer los datos operativos."))
      .finally(() => setLoading(false));
  }, []);

  function selectTab(next: Tab) {
    setTab(next);
    setEditing(null);
    setConfirmDelete(null);
    setMessage(null);
    setError(null);
  }

  async function save(resource: Resource, input: object) {
    setError(null);
    setMessage(null);
    try {
      if (editing) await updateRecord(resource, editing.id, input);
      else await createRecord(resource, input);
      await refresh();
      setEditing(null);
      setMessage(editing ? "Registro actualizado y auditado." : "Registro creado y auditado.");
    } catch (caught) {
      setError(mutationMessage(caught));
    }
  }

  async function remove(resource: Resource, id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setError(null);
    try {
      await deleteRecord(resource, id);
      await refresh();
      setConfirmDelete(null);
      setEditing(null);
      setMessage("Registro eliminado y operación auditada.");
    } catch (caught) {
      setError(mutationMessage(caught));
    }
  }

  return (
    <section className="data-page">
      <div className="data-hero">
        <div>
          <span className="eyebrow">PostgreSQL · entorno de demostración</span>
          <h1>Explorador de datos operativos</h1>
          <p>
            Permite probar el sistema sobre las mismas tablas que consultan las herramientas MCP,
            con API tipada, SQL parametrizado y control de acceso por rol.
          </p>
        </div>
        <span className={`access-badge ${canWrite ? "write" : "read"}`}>
          {canWrite ? "Lectura + CRUD" : "Sólo lectura"}
        </span>
      </div>

      <div className="data-policy">
        <div><span>Expuestas</span><code>departments · employees · attendance_records</code></div>
        <div><span>Protegidas</span><code>app_users · app_sessions · audit_events</code></div>
        <div><span>Guardrail</span><code>sin editor SQL libre</code></div>
      </div>

      <div className="data-tabs" role="tablist" aria-label="Tablas operativas">
        {(Object.keys(tabLabels) as Tab[]).map((item) => (
          <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => selectTab(item)}>
            {tabLabels[item]}
            <small>{snapshot ? (item === "attendance" ? snapshot.attendanceRecords.length : snapshot[item].length) : "–"}</small>
          </button>
        ))}
      </div>

      {loading ? <p className="data-state">Consultando PostgreSQL…</p> : !snapshot ? (
        <p className="query-error" role="alert">{error}</p>
      ) : (
        <div className={`data-workspace ${canWrite ? "with-editor" : ""}`}>
          <section className="panel data-table-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">Vista permitida</span><h2>{tabLabels[tab]}</h2></div>
              <span className="readonly-pill">Consulta parametrizada</span>
            </div>
            {tab === "departments" && <DepartmentTable rows={snapshot.departments} canWrite={canWrite} editing={editing} confirming={confirmDelete} onEdit={setEditing} onDelete={(id) => void remove("departments", id)} />}
            {tab === "employees" && <EmployeeTable rows={snapshot.employees} canWrite={canWrite} editing={editing} confirming={confirmDelete} onEdit={setEditing} onDelete={(id) => void remove("employees", id)} />}
            {tab === "attendance" && <AttendanceTable rows={snapshot.attendanceRecords} canWrite={canWrite} editing={editing} confirming={confirmDelete} onEdit={setEditing} onDelete={(id) => void remove("attendance", id)} />}
          </section>

          {canWrite && (
            <section className="panel data-editor">
              <div className="panel-heading"><div><span className="eyebrow">Operación administrativa</span><h2>{editing ? "Editar registro" : "Crear registro"}</h2></div><span className="readonly-pill">Auditable</span></div>
              {tab === "departments" && <DepartmentForm editing={editing as Department | null} onSave={(input) => void save("departments", input)} onCancel={() => setEditing(null)} />}
              {tab === "employees" && <EmployeeForm editing={editing as Employee | null} departments={snapshot.departments} onSave={(input) => void save("employees", input)} onCancel={() => setEditing(null)} />}
              {tab === "attendance" && <AttendanceForm key={editing?.id ?? "new-attendance"} editing={editing as AttendanceRecord | null} employees={snapshot.employees} onSave={(input) => void save("attendance", input)} onCancel={() => setEditing(null)} />}
              {message && <p className="admin-message">{message}</p>}
              {error && <p className="query-error" role="alert">{error}</p>}
            </section>
          )}
        </div>
      )}
    </section>
  );
}

type TableProps<T> = { rows: T[]; canWrite: boolean; editing: { id: string } | null; confirming: string | null; onEdit: (row: T) => void; onDelete: (id: string) => void };

function Actions<T extends { id: string }>({ row, canWrite, editing, confirming, onEdit, onDelete }: Omit<TableProps<T>, "rows"> & { row: T }) {
  if (!canWrite) return null;
  return <td className="row-actions"><button className={editing?.id === row.id ? "active" : ""} onClick={() => onEdit(row)}>Editar</button><button className={confirming === row.id ? "confirm" : ""} onClick={() => onDelete(row.id)}>{confirming === row.id ? "Confirmar" : "Eliminar"}</button></td>;
}

function DepartmentTable(props: TableProps<Department>) {
  return <div className="structured-table-wrap"><table className="structured-table data-table"><thead><tr><th>Código</th><th>Nombre</th><th>Creación</th>{props.canWrite && <th>Acciones</th>}</tr></thead><tbody>{props.rows.map((row) => <tr key={row.id}><td><code>{row.code}</code></td><td>{row.name}</td><td>{new Date(row.createdAt).toLocaleDateString("es-AR")}</td><Actions row={row} {...props} /></tr>)}</tbody></table></div>;
}

function EmployeeTable(props: TableProps<Employee>) {
  return <div className="structured-table-wrap"><table className="structured-table data-table"><thead><tr><th>Legajo</th><th>Empleado</th><th>Departamento</th><th>Estado</th>{props.canWrite && <th>Acciones</th>}</tr></thead><tbody>{props.rows.map((row) => <tr key={row.id}><td><code>{row.employeeNumber}</code></td><td>{row.firstName} {row.lastName}</td><td>{row.departmentCode}</td><td>{row.active ? "Activo" : "Inactivo"}</td><Actions row={row} {...props} /></tr>)}</tbody></table></div>;
}

function AttendanceTable(props: TableProps<AttendanceRecord>) {
  const status = { present: "Presente", absent: "Ausente", leave: "Licencia" };
  return <div className="structured-table-wrap"><table className="structured-table data-table"><thead><tr><th>Fecha</th><th>Empleado</th><th>Estado</th><th>Programado / llegada</th><th>Fuente</th>{props.canWrite && <th>Acciones</th>}</tr></thead><tbody>{props.rows.map((row) => <tr key={row.id}><td>{row.workDate}</td><td>{row.employeeName}<small>{row.employeeNumber}</small></td><td>{status[row.status]}</td><td>{new Date(row.scheduledStart).toLocaleString("es-AR")}<small>{row.actualArrival ? `Llegada: ${new Date(row.actualArrival).toLocaleString("es-AR")}` : row.absenceReason ?? "Sin llegada"}</small></td><td><code>{row.source}</code></td><Actions row={row} {...props} /></tr>)}</tbody></table></div>;
}

function DepartmentForm({ editing, onSave, onCancel }: { editing: Department | null; onSave: (input: object) => void; onCancel: () => void }) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onSave({ code: data.get("code"), name: data.get("name") }); }
  return <form key={editing?.id ?? "new"} onSubmit={submit}><label>Código<input name="code" defaultValue={editing?.code ?? ""} required minLength={2} maxLength={20} /></label><label>Nombre<input name="name" defaultValue={editing?.name ?? ""} required minLength={2} maxLength={100} /></label><FormActions editing={editing} onCancel={onCancel} /></form>;
}

function EmployeeForm({ editing, departments, onSave, onCancel }: { editing: Employee | null; departments: Department[]; onSave: (input: object) => void; onCancel: () => void }) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onSave({ employeeNumber: data.get("employeeNumber"), firstName: data.get("firstName"), lastName: data.get("lastName"), departmentId: data.get("departmentId"), timezone: data.get("timezone"), active: data.get("active") === "on" }); }
  return <form key={editing?.id ?? "new"} onSubmit={submit}><label>Legajo<input name="employeeNumber" defaultValue={editing?.employeeNumber ?? ""} required /></label><div className="editor-columns"><label>Nombre<input name="firstName" defaultValue={editing?.firstName ?? ""} required /></label><label>Apellido<input name="lastName" defaultValue={editing?.lastName ?? ""} required /></label></div><label>Departamento<select name="departmentId" defaultValue={editing?.departmentId ?? ""} required><option value="" disabled>Seleccionar…</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}</option>)}</select></label><label>Zona horaria<input name="timezone" defaultValue={editing?.timezone ?? "America/Argentina/Buenos_Aires"} required /></label><label className="checkbox-label"><input name="active" type="checkbox" defaultChecked={editing?.active ?? true} /> Empleado activo</label><FormActions editing={editing} onCancel={onCancel} /></form>;
}

function AttendanceForm({ editing, employees, onSave, onCancel }: { editing: AttendanceRecord | null; employees: Employee[]; onSave: (input: object) => void; onCancel: () => void }) {
  const [status, setStatus] = useState(editing?.status ?? "present");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const arrival = String(data.get("actualArrival") ?? ""); onSave({ employeeId: data.get("employeeId"), workDate: data.get("workDate"), scheduledStart: new Date(String(data.get("scheduledStart"))).toISOString(), actualArrival: status === "present" && arrival ? new Date(arrival).toISOString() : null, status, absenceReason: status === "present" ? null : String(data.get("absenceReason") ?? "") || null, source: data.get("source") }); }
  return <form key={editing?.id ?? "new"} onSubmit={submit}><label>Empleado<select name="employeeId" defaultValue={editing?.employeeId ?? ""} required><option value="" disabled>Seleccionar…</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} · {employee.firstName} {employee.lastName}</option>)}</select></label><label>Fecha laboral<input name="workDate" type="date" defaultValue={editing?.workDate ?? ""} required /></label><label>Inicio programado<input name="scheduledStart" type="datetime-local" defaultValue={localDateTime(editing?.scheduledStart ?? null)} required /></label><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value as AttendanceRecord["status"])}><option value="present">Presente</option><option value="absent">Ausente</option><option value="leave">Licencia</option></select></label>{status === "present" ? <label>Llegada real<input name="actualArrival" type="datetime-local" defaultValue={localDateTime(editing?.actualArrival ?? null)} required /></label> : <label>Motivo<input name="absenceReason" defaultValue={editing?.absenceReason ?? ""} maxLength={500} /></label>}<label>Fuente<input name="source" defaultValue={editing?.source ?? "manual-demo"} required /></label><FormActions editing={editing} onCancel={onCancel} /></form>;
}

function FormActions({ editing, onCancel }: { editing: { id: string } | null; onCancel: () => void }) {
  return <div className="editor-actions"><button className="run-button">{editing ? "Guardar cambios" : "Crear registro"}</button>{editing && <button type="button" onClick={onCancel}>Cancelar edición</button>}</div>;
}
