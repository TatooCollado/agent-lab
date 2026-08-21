export type UserRole = "admin" | "viewer";

export type SessionUser = {
  id: string;
  username: string;
  role: UserRole;
};

export type UserSummary = SessionUser & {
  active: boolean;
  createdAt: string;
};

async function errorCode(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  return typeof body === "object" && body !== null && "error" in body
    ? String(body.error)
    : "unknown_error";
}

export async function currentSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(await errorCode(response));
  return ((await response.json()) as { user: SessionUser }).user;
}

export async function login(username: string, password: string): Promise<SessionUser> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  if (!response.ok) throw new Error(await errorCode(response));
  return ((await response.json()) as { user: SessionUser }).user;
}

export async function logout(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include"
  });
  if (!response.ok && response.status !== 401) throw new Error(await errorCode(response));
}

export async function listUsers(): Promise<UserSummary[]> {
  const response = await fetch("/api/admin/users", { credentials: "include" });
  if (!response.ok) throw new Error(await errorCode(response));
  return ((await response.json()) as { users: UserSummary[] }).users;
}

export async function createUser(input: {
  username: string;
  password: string;
  role: UserRole;
}): Promise<UserSummary> {
  const response = await fetch("/api/admin/users", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error(await errorCode(response));
  return ((await response.json()) as { user: UserSummary }).user;
}

export async function clearHrData(): Promise<Record<string, number>> {
  const response = await fetch("/api/admin/hr-data", {
    method: "DELETE",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "DELETE HR DATA" })
  });
  if (!response.ok) throw new Error(await errorCode(response));
  return ((await response.json()) as { deleted: Record<string, number> }).deleted;
}
