import { useState, type FormEvent } from "react";
import { login, type SessionUser } from "./api";

export function LoginScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: SessionUser) => void;
}) {
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
      setError("Usuario o contraseña incorrectos.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <span className="brand-mark">AL</span>
        <span className="eyebrow">Acceso seguro al demostrador</span>
        <h1>Ingresar a Agent Lab</h1>
        <p>
          Sesión opaca · cookie HttpOnly · identidad almacenada en PostgreSQL
        </p>
        <form onSubmit={(event) => void submit(event)}>
          <label htmlFor="username">Usuario</label>
          <input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={12}
            required
          />
          <button className="run-button" disabled={submitting}>
            {submitting ? "Verificando…" : "Ingresar"}
          </button>
          {error && (
            <p className="query-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
