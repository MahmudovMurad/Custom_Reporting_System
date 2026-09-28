// İstifadəçi yaradır (ilk admin üçün). İstifadə:
//   npm run user:create -- --email a@b.az --name "Ad Soyad" --role admin [--password X]
// Şifrə verilməsə təsadüfi yaradılıb ekrana çıxarılır. DATABASE_URL yoxdursa lokal PGlite istifadə olunur (dev server dayandırılmalıdır).
import "dotenv/config";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { connect } from "../src/db/connect";
import { ROLES, users, type Role } from "../src/db/schema";
import { generatePassword, hashPassword, passwordProblem } from "../src/lib/password";

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" }, role: { type: "string", default: "viewer" }, password: { type: "string" } },
});
const email = (values.email || "").trim().toLowerCase();
const name = (values.name || "").trim();
const role = values.role as Role;
if (!email || !name || !ROLES.includes(role)) {
  console.error('İstifadə: npm run user:create -- --email a@b.az --name "Ad" --role admin|viewer [--password X]');
  process.exit(1);
}
const password = values.password || generatePassword();
const problem = passwordProblem(password);
if (problem) { console.error(problem); process.exit(1); }

const { db, close, kind } = await connect();
try {
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) { console.error(`Bu email ilə istifadəçi artıq var: ${email}`); process.exitCode = 1; }
  else {
    await db.insert(users).values({ email, name, role, passwordHash: await hashPassword(password) });
    console.log(`Yaradıldı (${kind}): ${email} · ${role}`);
    if (!values.password) console.log(`Şifrə: ${password}`);
  }
} finally {
  await close();
}
