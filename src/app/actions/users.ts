"use server";

import { and, asc, count, eq, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ROLES, type Role } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { generatePassword, hashPassword, passwordProblem } from "@/lib/password";

// Bütün funksiyalar admin yoxlaması ilə başlayır — UI-da gizlətmək kifayət deyil.

export type UserRow = {
  id: string; email: string; name: string; role: Role;
  createdAt: string; lastLoginAt: string | null;
};
export type Result = { ok: true; password?: string; message?: string } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function listUsers(): Promise<UserRow[]> {
  await requireAdmin();
  const db = await getDb();
  const rows = await db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, role: schema.users.role,
      createdAt: schema.users.createdAt, lastLoginAt: schema.users.lastLoginAt })
    .from(schema.users)
    .orderBy(asc(schema.users.name));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), lastLoginAt: r.lastLoginAt?.toISOString() ?? null }));
}

export async function createUser(input: { email: string; name: string; role: Role; password?: string }): Promise<Result> {
  await requireAdmin();
  const email = input.email.trim().toLowerCase(), name = input.name.trim();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Email düzgün deyil." };
  if (!name) return { ok: false, error: "Ad daxil edin." };
  if (!ROLES.includes(input.role)) return { ok: false, error: "Rol düzgün deyil." };
  const generated = !input.password;
  const password = input.password || generatePassword();
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };

  const db = await getDb();
  const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (exists) return { ok: false, error: "Bu email ilə istifadəçi artıq var." };
  await db.insert(schema.users).values({ email, name, role: input.role, passwordHash: await hashPassword(password) });
  return { ok: true, password: generated ? password : undefined };
}

async function otherAdmins(db: Awaited<ReturnType<typeof getDb>>, id: string) {
  const [r] = await db.select({ n: count() }).from(schema.users)
    .where(and(eq(schema.users.role, "admin"), ne(schema.users.id, id)));
  return r.n;
}

export async function deleteUser(id: string): Promise<Result> {
  const me = await requireAdmin();
  if (id === me.id) return { ok: false, error: "Öz hesabınızı silə bilməzsiniz." };
  const db = await getDb();
  const [u] = await db.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, id));
  if (!u) return { ok: false, error: "İstifadəçi tapılmadı." };
  if (u.role === "admin" && (await otherAdmins(db, id)) === 0) return { ok: false, error: "Sonuncu admini silmək olmaz." };
  await db.delete(schema.users).where(eq(schema.users.id, id));   // session-lar cascade ilə silinir
  return { ok: true };
}

export async function resetPassword(id: string): Promise<Result> {
  await requireAdmin();
  const db = await getDb();
  const password = generatePassword();
  const r = await db.update(schema.users).set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
    .where(eq(schema.users.id, id)).returning({ id: schema.users.id });
  if (!r.length) return { ok: false, error: "İstifadəçi tapılmadı." };
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));   // köhnə girişlər bağlanır
  return { ok: true, password };
}

export async function setRole(id: string, role: Role): Promise<Result> {
  const me = await requireAdmin();
  if (!ROLES.includes(role)) return { ok: false, error: "Rol düzgün deyil." };
  if (id === me.id && role !== "admin") return { ok: false, error: "Öz admin hüququnuzu götürə bilməzsiniz." };
  const db = await getDb();
  if (role !== "admin" && (await otherAdmins(db, id)) === 0) return { ok: false, error: "Ən azı bir admin qalmalıdır." };
  await db.update(schema.users).set({ role, updatedAt: new Date() }).where(eq(schema.users.id, id));
  return { ok: true };
}
