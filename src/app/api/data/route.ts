import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/dal";

// Panelin datası — yalnız login olmuş istifadəçiyə. ETag ilə: dəyişməyibsə 304 (brauzer yenidən yükləmir).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const db = await getDb();
  const [ds] = await db.select({ hash: schema.datasets.hash, payload: schema.datasets.payload })
    .from(schema.datasets).orderBy(desc(schema.datasets.id)).limit(1);
  if (!ds) return Response.json({ error: "Hələ data yoxdur — sync gözlənilir." }, { status: 404 });
  const etag = `"${ds.hash.slice(0, 32)}"`;
  const headers = { etag, "cache-control": "private, no-cache" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(ds.payload, { headers: { ...headers, "content-type": "application/json; charset=utf-8" } });
}
