import { useEffect, useState, type FormEvent } from "react";
import {
  clearHrData,
  createUser,
  listUsers,
  type UserRole,
  type UserSummary,
} from "./api";

export function AdminPanel() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function refreshUsers() {
    setUsers(await listUsers());
  }

  useEffect(() => {
    void refreshUsers().catch(() =>
      setMessage("No se pudieron cargar los usuarios."),
    );
  }, []);

  async function submitUser(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      const user = await createUser({ username, password, role });
      setUsername("");
      setPassword("");
      setMessage(`Usuario ${user.username} creado.`);
      await refreshUsers();
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === "username_exists"
          ? "El nombre de usuario ya existe."
          : "No se pudo crear el usuario.",
      );
    }
  }

  async function executeClear() {
    const deleted = await clearHrData();
    setConfirmation("");
    setMessage(
      `Datos de RR. HH. eliminados: ${Object.values(deleted).reduce((sum, count) => sum + count, 0)} filas.`,
    );
  }

  return (
    <section className="admin-page">
      <div className="index-heading">
        <span className="eyebrow">Control de acceso basado en roles</span>
        <h1>Administración</h1>
        <p>
          Alta controlada de usuarios y limpieza transaccional de datos de RR.
          HH.
        </p>
      </div>
      {message && (
        <p className="admin-message" role="status">
          {message}
        </p>
      )}
      <div className="admin-grid">
        <section className="panel admin-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Ciclo de vida de identidades</span>
              <h2>Crear usuario</h2>
            </div>
          </div>
          <form onSubmit={(event) => void submitUser(event)}>
            <label htmlFor="new-username">Usuario</label>
            <input
              id="new-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              pattern="[a-zA-Z0-9._-]+"
              required
            />
            <label htmlFor="new-password">Contraseña</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={12}
              required
            />
            <label htmlFor="new-role">Rol</label>
            <select
              id="new-role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
            >
              <option value="viewer">Consulta · sólo lectura</option>
              <option value="admin">Administrador</option>
            </select>
            <button className="run-button">Crear usuario</button>
          </form>
        </section>
        <section className="panel admin-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Estado de autorización</span>
              <h2>Usuarios</h2>
            </div>
          </div>
          <div className="user-list">
            {users.map((user) => (
              <div key={user.id}>
                <span>{user.username}</span>
                <code>{user.role}</code>
                <i>{user.active ? "activo" : "deshabilitado"}</i>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="danger-zone">
        <span className="eyebrow">Operación destructiva · auditada</span>
        <h2>Eliminar datos operativos de RR. HH.</h2>
        <p>
          Elimina asistencias, empleados y departamentos dentro de una
          transacción. Conserva el esquema, los usuarios y los eventos de
          auditoría.
        </p>
        <label htmlFor="delete-confirmation">
          Escribí DELETE HR DATA para habilitar
        </label>
        <div>
          <input
            id="delete-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <button
            disabled={confirmation !== "DELETE HR DATA"}
            onClick={() => void executeClear()}
          >
            Eliminar datos de RR. HH.
          </button>
        </div>
      </section>
    </section>
  );
}
