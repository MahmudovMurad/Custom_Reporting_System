import { desc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/dal";

// Panelin datası — yalnız login olmuş istifadəçiyə. ETag ilə: dəyişməyibsə 304 (brauzer yenidən yükləmir).
// "x-last-check": son uğurlu sync yoxlamasının vaxtı (yuxarı zolaqda "Son yoxlama").
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const db = await getDb();
  const [[ds], [run]] = await Promise.all([
    db.select({ hash: schema.datasets.hash, payload: schema.datasets.payload }).from(schema.datasets).orderBy(desc(schema.datasets.id)).limit(1),
    db.select({ at: schema.syncRuns.finishedAt }).from(schema.syncRuns)
      .where(inArray(schema.syncRuns.status, ["ok", "unchanged"])).orderBy(desc(schema.syncRuns.id)).limit(1),
  ]);
  const lastCheck: Record<string, string> = run?.at ? { "x-last-check": run.at.toISOString() } : {};
  if (!ds) return Response.json({ error: "Hələ data yoxdur — sync gözlənilir." }, { status: 404, headers: lastCheck });
  const etag = `"${ds.hash.slice(0, 32)}"`;
  // no-store: brauzer və aralıq proxy-lər paketi saxlamasın (304 yoxlaması klientin göndərdiyi if-none-match ilə işləyir)
  const headers = { etag, "cache-control": "private, no-store, max-age=0", vary: "Cookie", ...lastCheck };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(ds.payload, { headers: { ...headers, "content-type": "application/json; charset=utf-8" } });
}
