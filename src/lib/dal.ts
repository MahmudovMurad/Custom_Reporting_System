import "server-only";
import { cache } from "react";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import type { Role } from "@/db/schema";
import { SESSION_COOKIE, hashToken } from "./session";

export type CurrentUser = { id: string; email: string; name: string; role: Role };

// Bütün auth yoxlamalarının mərkəzi: cookie-dəki token → DB-dəki etibarlı session → istifadəçi.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, role: schema.users.role })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Bu əməliyyat yalnız admin üçündür.");
  return user;
}
