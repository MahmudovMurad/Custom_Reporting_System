import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Conn = { db: DB; close: () => Promise<void>; kind: "postgres" | "pglite" };

// DATABASE_URL varsa (Vercel/Neon) postgres-js, yoxdursa lokal PGlite (.data/pglite) — lokal inkişaf DB quraşdırmadan işləyir.
// PGlite rejimində miqrasiyalar avtomatik tətbiq olunur; Postgres-də `npm run db:migrate` ilə.
// Vercel-in Neon inteqrasiyası prefiksli ad da yarada bilir (layihədə "neon_" prefiksi ilə qoşulub)
export const databaseUrl = () => process.env.DATABASE_URL || process.env.neon_DATABASE_URL || "";

export async function connect(): Promise<Conn> {
  const url = databaseUrl();
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    // prepare:false — Neon-un pooled (PgBouncer) qoşulması ilə uyğunluq üçün
    const client = postgres(url, { prepare: false, max: 5 });
    return { db: drizzle(client, { schema }) as unknown as DB, close: () => client.end(), kind: "postgres" };
  }
  if (process.env.VERCEL) throw new Error("DATABASE_URL təyin olunmayıb");
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = process.env.PGLITE_DIR || ".data/pglite";
  (await import("node:fs")).mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { db: db as unknown as DB, close: () => client.close(), kind: "pglite" };
}
