import { timingSafeEqual } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { and, asc, eq, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { checkSource, runSync, type Trigger } from "@/lib/sync";

// Sheet-in Apps Script-i (apps-script/Code.gs) datanı bura göndərir. Auth: "Authorization: Bearer <SYNC_SECRET>".
//  1) {kind:"check", sourceHash}          → hash dəyişməyibsə "unchanged" (data göndərilmir), əks halda {need:"full"}
//  2) {kind:"part", uploadId, part, total, main, stock?}  (gzip) → hissələr yığılır, sonuncuda sync işləyir
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const TRIGGERS: Record<string, Trigger> = { timer: "auto", menu: "sheet", web: "manual" };

type Body = {
  kind: "check" | "part"; trigger?: string; requestedBy?: string | null; sourceHash: string;
  uploadId?: string; part?: number; total?: number; main?: string[][]; stock?: string[][] | null;
};

function authorized(req: Request): boolean {
  const secret = process.env.SYNC_SECRET?.trim();      // Windows-dan əlavə olunanda sonda "\r" qala bilir
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") || ""), want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const raw = Buffer.from(await req.arrayBuffer());
  const gz = raw[0] === 0x1f && raw[1] === 0x8b;
  let body: Body;
  try { body = JSON.parse((gz ? gunzipSync(raw) : raw).toString("utf8")); }
  catch { return Response.json({ error: "Sorğu oxunmadı" }, { status: 400 }); }

  const db = await getDb();
  const trigger = TRIGGERS[body.trigger || ""] ?? "auto";
  const userId = body.requestedBy && UUID.test(body.requestedBy) ? body.requestedBy : null;
  if (!body.sourceHash) return Response.json({ error: "sourceHash yoxdur" }, { status: 400 });

  if (body.kind === "check") {
    const r = await checkSource(db, { trigger, userId, sourceHash: body.sourceHash });
    return Response.json(r ?? { need: "full" });
  }

  if (body.kind !== "part" || !body.uploadId || !UUID.test(body.uploadId) || !Number.isInteger(body.part) || !Number.isInteger(body.total)
    || body.total! < 1 || body.total! > 100 || body.part! < 0 || body.part! >= body.total!) {
    return Response.json({ error: "Hissə məlumatı düzgün deyil" }, { status: 400 });
  }
  // hissə saxlanılır (təkrar göndərilsə üzərinə yazılır); 1 saatdan köhnə yarımçıq yüklər silinir
  const data = raw.toString("base64");
  await db.insert(schema.ingestParts).values({ uploadId: body.uploadId, part: body.part!, total: body.total!, data })
    .onConflictDoUpdate({ target: [schema.ingestParts.uploadId, schema.ingestParts.part], set: { data } });
  await db.delete(schema.ingestParts).where(lt(schema.ingestParts.createdAt, new Date(Date.now() - 3600e3)));
  const parts = await db.select().from(schema.ingestParts).where(eq(schema.ingestParts.uploadId, body.uploadId)).orderBy(asc(schema.ingestParts.part));
  if (parts.length < body.total!) return Response.json({ status: "part", received: parts.length, total: body.total });

  // bütün hissələr gəlib: birləşdir və sync et
  let main: string[][] = [], stock: string[][] | null = null;
  for (const p of parts) {
    const buf = Buffer.from(p.data, "base64");
    const b = JSON.parse((buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf).toString("utf8")) as Body;
    main = main.concat(b.main ?? []);
    if (b.stock) stock = b.stock;
  }
  await db.delete(schema.ingestParts).where(and(eq(schema.ingestParts.uploadId, body.uploadId)));
  const result = await runSync(db, {
    trigger, userId, sourceHash: body.sourceHash,
    source: async () => ({ main, stock, warnings: stock ? [] : [`"Real Stock" vərəqi göndərilmədi — stok yenilənmədi`] }),
  });
  return Response.json(result, { status: result.status === "error" ? 500 : 200 });
}
