import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(12).max(200)
});

export const createUserSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(12).max(200),
  role: z.enum(["admin", "viewer"])
});

export const clearHrDataSchema = z.object({
  confirmation: z.literal("DELETE HR DATA")
});

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
