import "server-only";
import { and, count, eq, gt, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";

const WINDOW_MIN = 15;
const MAX_PER_EMAIL = 5;   // eyni email üçün 15 dəq-də uğursuz cəhd
const MAX_PER_IP = 30;     // eyni IP üçün 15 dəq-də uğursuz cəhd

export async function loginBlocked(email: string, ip: string | null): Promise<boolean> {
  const db = await getDb();
  const since = new Date(Date.now() - WINDOW_MIN * 60e3);
  const failed = (w: ReturnType<typeof eq>) =>
    db.select({ n: count() }).from(schema.loginAttempts)
      .where(and(w, eq(schema.loginAttempts.success, false), gt(schema.loginAttempts.createdAt, since)));
  const [[byEmail], byIp] = await Promise.all([
    failed(eq(schema.loginAttempts.email, email)),
    ip ? failed(eq(schema.loginAttempts.ip, ip)).then((r) => r[0]) : Promise.resolve({ n: 0 }),
  ]);
  return byEmail.n >= MAX_PER_EMAIL || byIp.n >= MAX_PER_IP;
}

export async function recordAttempt(email: string, ip: string | null, success: boolean) {
  const db = await getDb();
  await db.insert(schema.loginAttempts).values({ email, ip, success });
  if (success) {
    // uğurlu girişdən sonra həmin email-in sayğacı sıfırlanır; köhnə qeydlər təmizlənir
    await db.delete(schema.loginAttempts).where(and(eq(schema.loginAttempts.email, email), eq(schema.loginAttempts.success, false)));
    await db.delete(schema.loginAttempts).where(lt(schema.loginAttempts.createdAt, new Date(Date.now() - 30 * 864e5)));
  }
}
