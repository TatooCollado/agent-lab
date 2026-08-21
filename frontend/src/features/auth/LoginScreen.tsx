import { useState, type FormEvent } from "react";
import { login, type SessionUser } from "./api";

export function LoginScreen({ onAuthenticated }: { onAuthenticated: (user: SessionUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      onAuthenticated(await login(username, password));
    } catch {
      setError("Invalid username or password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <span className="brand-mark">AL</span>
        <span className="eyebrow">Authentication boundary</span>
        <h1>Agent Lab access</h1>
        <p>Opaque session · HttpOnly cookie · PostgreSQL-backed identity</p>
        <form onSubmit={(event) => void submit(event)}>
          <label htmlFor="username">Username</label>
          <input id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} required />
          <button className="run-button" disabled={submitting}>{submitting ? "Authenticating…" : "Sign in"}</button>
          {error && <p className="query-error" role="alert">{error}</p>}
        </form>
      </section>
    </main>
  );
}
