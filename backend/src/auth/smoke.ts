import request from "supertest";
import { createApp } from "../app.js";
import { loadEnv } from "../config/env.js";
import { DatabaseAuthService } from "./service.js";

const env = loadEnv();
if (!env.SEED_ADMIN_PASSWORD || !env.SEED_VIEWER_PASSWORD) {
  throw new Error("Seeded credentials are required for the authentication smoke test");
}

const auth = new DatabaseAuthService(env.SESSION_TTL_HOURS);
const app = createApp({ auth });

try {
  const scenarios = [
    { username: "admin", password: env.SEED_ADMIN_PASSWORD, role: "admin" },
    { username: "viewer", password: env.SEED_VIEWER_PASSWORD, role: "viewer" }
  ];
  const results = [];

  for (const scenario of scenarios) {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ username: scenario.username, password: scenario.password });
    if (login.status !== 200 || login.body.user?.role !== scenario.role) {
      throw new Error(`Authentication failed for ${scenario.username}`);
    }
    const cookie = login.headers["set-cookie"]?.[0];
    if (!cookie?.includes("HttpOnly") || !cookie.includes("SameSite=Strict")) {
      throw new Error("Secure session cookie attributes are missing");
    }
    const me = await request(app).get("/api/auth/me").set("cookie", cookie);
    if (me.status !== 200 || me.body.user?.username !== scenario.username) {
      throw new Error(`Session lookup failed for ${scenario.username}`);
    }
    const logout = await request(app).post("/api/auth/logout").set("cookie", cookie);
    if (logout.status !== 204) throw new Error(`Logout failed for ${scenario.username}`);
    results.push({ username: scenario.username, role: scenario.role, session: "verified" });
  }

  console.info(JSON.stringify({ status: "ok", results }));
} finally {
  await auth.close();
}
