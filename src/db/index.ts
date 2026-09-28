import "server-only";
import { connect, type DB } from "./connect";

export type { DB };
export * as schema from "./schema";

// Next dev bir neçə modul nüsxəsi yarada bilir; PGlite tək prosesli olduğu üçün qoşulma globalThis-də bir dəfə yaradılır.
const g = globalThis as unknown as { __srDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  if (!g.__srDb) {
    g.__srDb = connect().then((c) => c.db).catch((e) => {
      g.__srDb = undefined;
      throw e;
    });
  }
  return g.__srDb;
}
