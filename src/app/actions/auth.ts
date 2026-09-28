"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/dal";
import { burnVerify, hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { loginBlocked, recordAttempt } from "@/lib/rate-limit";
import { clientInfo, createSession, deleteCurrentSession } from "@/lib/session";

export type LoginState = { error?: string; email?: string } | undefined;

const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/login") ? s : "/";
};

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Email və şifrəni daxil edin.", email };

  const { ip } = await clientInfo();
  if (await loginBlocked(email, ip)) {
    return { error: "Çox sayda uğursuz cəhd. 15 dəqiqə sonra yenidən yoxlayın.", email };
  }

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const ok = user ? await verifyPassword(user.passwordHash, password) : (await burnVerify(password), false);
  await recordAttempt(email, ip, ok);
  if (!user || !ok) return { error: "Email və ya şifrə yanlışdır.", email };

  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await deleteCurrentSession();
  redirect("/login");
}

export type PasswordState = { error?: string; ok?: boolean } | undefined;

export async function changeOwnPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const me = await requireUser();
  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== String(formData.get("confirm") || "")) return { error: "Yeni şifrələr eyni deyil." };

  const db = await getDb();
  const [row] = await db.select({ h: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, me.id));
  if (!row || !(await verifyPassword(row.h, current))) return { error: "Hazırkı şifrə yanlışdır." };

  await db.update(schema.users).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(schema.users.id, me.id));
  return { ok: true };
}
