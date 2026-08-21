import { useEffect, useState, type FormEvent } from "react";
import { clearHrData, createUser, listUsers, type UserRole, type UserSummary } from "./api";

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
    void refreshUsers().catch(() => setMessage("Unable to load users."));
  }, []);

  async function submitUser(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      const user = await createUser({ username, password, role });
      setUsername("");
      setPassword("");
      setMessage(`User ${user.username} created.`);
      await refreshUsers();
    } catch (error) {
      setMessage(error instanceof Error && error.message === "username_exists" ? "Username already exists." : "User could not be created.");
    }
  }

  async function executeClear() {
    const deleted = await clearHrData();
    setConfirmation("");
    setMessage(`HR data cleared: ${Object.values(deleted).reduce((sum, count) => sum + count, 0)} rows.`);
  }

  return (
    <section className="admin-page">
      <div className="index-heading">
        <span className="eyebrow">Role-based access control</span>
        <h1>Administration</h1>
        <p>Controlled user provisioning and transactional HR data reset.</p>
      </div>
      {message && <p className="admin-message" role="status">{message}</p>}
      <div className="admin-grid">
        <section className="panel admin-panel">
          <div className="panel-heading"><div><span className="eyebrow">Identity lifecycle</span><h2>Create user</h2></div></div>
          <form onSubmit={(event) => void submitUser(event)}>
            <label htmlFor="new-username">Username</label>
            <input id="new-username" value={username} onChange={(event) => setUsername(event.target.value)} pattern="[a-zA-Z0-9._-]+" required />
            <label htmlFor="new-password">Password</label>
            <input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} required />
            <label htmlFor="new-role">Role</label>
            <select id="new-role" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              <option value="viewer">Viewer · read only</option>
              <option value="admin">Admin</option>
            </select>
            <button className="run-button">Create user</button>
          </form>
        </section>
        <section className="panel admin-panel">
          <div className="panel-heading"><div><span className="eyebrow">Authorization state</span><h2>Users</h2></div></div>
          <div className="user-list">
            {users.map((user) => <div key={user.id}><span>{user.username}</span><code>{user.role}</code><i>{user.active ? "active" : "disabled"}</i></div>)}
          </div>
        </section>
      </div>
      <section className="danger-zone">
        <span className="eyebrow">Destructive operation · audited</span>
        <h2>Clear HR operational data</h2>
        <p>Deletes attendance, employees and departments in one transaction. Schema, users and audit events are preserved.</p>
        <label htmlFor="delete-confirmation">Type DELETE HR DATA to enable</label>
        <div><input id="delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /><button disabled={confirmation !== "DELETE HR DATA"} onClick={() => void executeClear()}>Clear HR data</button></div>
      </section>
    </section>
  );
}
