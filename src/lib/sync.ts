// Google Sheet → DB sync (handoff §7.2). Data Sheet-in öz Apps Script-i ilə gəlir (apps-script/Code.gs → /api/ingest);
// şirkətin Google təşkilatında servis hesabı açarı yaratmaq qadağandır. CLI (scripts/sync.mts) CSV fayllarından oxuyur.
import { and, desc, eq, inArray, lt, notInArray, sql } from "drizzle-orm";
import type { DB } from "@/db/connect";
import * as schema from "@/db/schema";
import { buildMainData, DIM_KEYS } from "./etl/crm";
import { isoDay } from "./etl/normalize";
import { buildPayload, hashes } from "./etl/payload";
import { parseRealStock, type StockRow } from "./etl/stock";

const LOCK_MIN = 5;
export type Trigger = "auto" | "sheet" | "manual" | "cli";

export type SyncResult = {
  status: schema.SyncStatus;
  runId?: number;
  message: string;
  durationMs?: number;
  warnings?: string[];
};

async function acquireLock(db: DB): Promise<boolean> {
  const until = new Date(Date.now() + LOCK_MIN * 60e3);
  const r = await db.insert(schema.locks).values({ name: "sync", until })
    .onConflictDoUpdate({ target: schema.locks.name, set: { until }, setWhere: lt(schema.locks.until, new Date()) })
    .returning({ name: schema.locks.name });
  return r.length > 0;
}
const releaseLock = (db: DB) => db.delete(schema.locks).where(eq(schema.locks.name, "sync"));

async function insertChunks<T extends Record<string, unknown>>(tx: DB, table: Parameters<DB["insert"]>[0], rows: T[], size: number) {
  for (let i = 0; i < rows.length; i += size) await tx.insert(table).values(rows.slice(i, i + size) as never);
}

export type Source = () => Promise<{ main: string[][]; stock: string[][] | null; warnings: string[] }>;
type Opts = { trigger: Trigger; userId?: string | null; minIntervalSec?: number; source: Source; sourceHash?: string };

const lastGoodRun = (db: DB) => db.select().from(schema.syncRuns)
  .where(inArray(schema.syncRuns.status, ["ok", "unchanged"])).orderBy(desc(schema.syncRuns.id)).limit(1).then((r) => r[0]);

/** Apps Script-in ilk (kiçik) sorğusu: Sheet-in hash-i son uğurlu sync ilə eynidirsə "unchanged" loqlanır, data göndərilmir. */
export async function checkSource(db: DB, opts: { trigger: Trigger; userId?: string | null; sourceHash: string }): Promise<SyncResult | null> {
  const last = await lastGoodRun(db);
  if (!last || last.sourceHash !== opts.sourceHash) return null;
  const now = new Date();
  const [run] = await db.insert(schema.syncRuns).values({
    trigger: opts.trigger, userId: opts.userId, status: "unchanged", startedAt: now, finishedAt: now, durationMs: 0,
    crmRecords: last.crmRecords, crmSkipped: last.crmSkipped, crmRows: last.crmRows, marketRecords: last.marketRecords, stockRows: last.stockRows,
    dataStart: last.dataStart, dataEnd: last.dataEnd, dataHash: last.dataHash, sourceHash: opts.sourceHash,
  }).returning({ id: schema.syncRuns.id });
  return { status: "unchanged", runId: run.id, message: "Sheet-də dəyişiklik yoxdur.", durationMs: 0 };
}

export async function runSync(db: DB, opts: Opts): Promise<SyncResult> {
  if (!(await acquireLock(db))) return { status: "skipped", message: "Başqa sync artıq gedir." };
  const t0 = Date.now();
  let runId: number | undefined;
  try {
    if (opts.minIntervalSec) {
      const [last] = await db.select({ at: schema.syncRuns.finishedAt }).from(schema.syncRuns)
        .where(inArray(schema.syncRuns.status, ["ok", "unchanged"])).orderBy(desc(schema.syncRuns.finishedAt)).limit(1);
      if (last?.at && Date.now() - last.at.getTime() < opts.minIntervalSec * 1000) {
        return { status: "skipped", message: `Son sync ${Math.round((Date.now() - last.at.getTime()) / 1000)} saniyə əvvəl olub.` };
      }
    }
    [{ id: runId }] = await db.insert(schema.syncRuns).values({ trigger: opts.trigger, userId: opts.userId, sourceHash: opts.sourceHash })
      .returning({ id: schema.syncRuns.id });

    // 1. Sheet datası
    const src = await opts.source();
    const mainValues = src.main, stockValues = src.stock;
    const warnings = [...src.warnings];

    // 2. Normallaşdır və cəmlə
    const { crm, market, warnings: w1 } = buildMainData(mainValues);
    warnings.push(...w1);
    let stock: StockRow[];
    if (stockValues) { const p = parseRealStock(stockValues); stock = p.rows; warnings.push(...p.warnings); }
    else {                                                // vərəq yoxdursa son snapshot saxlanılır
      const [snap] = await db.select().from(schema.stockSnapshots).orderBy(desc(schema.stockSnapshots.id)).limit(1);
      stock = snap ? (await db.select().from(schema.stockRows).where(eq(schema.stockRows.snapshotId, snap.id)).orderBy(schema.stockRows.pos))
        .map((r) => ({ brand: r.brand, model: r.model, version: r.version, year: r.year, price: r.price, faiz: r.faiz, ilkin: r.ilkin,
          muddet: r.muddet, ayliq: r.ayliq, stok: r.stok, real: r.real, hedef: r.hedef, actual: r.actual, beh: r.beh, qeyd: r.qeyd, period: r.period })) : [];
    }
    if (crm.skipped) warnings.push(`Main Data: ${crm.skipped} sətirdə tarix oxunmadı — atıldı`);
    const h = hashes(crm, market, stock);
    const dataEnd = isoDay(Math.round(Date.parse(crm.start) / 864e5) + crm.ndays - 1);
    const counts = {
      crmRecords: crm.records, crmSkipped: crm.skipped, crmRows: crm.cols.day.length, marketRecords: market.records,
      stockRows: stock.length, dataStart: crm.start, dataEnd, dataHash: h.all, warnings,
    };

    // 3. Dəyişiklik yoxdursa DB-yə yazma
    const [lastDs] = await db.select({ hash: schema.datasets.hash }).from(schema.datasets).orderBy(desc(schema.datasets.id)).limit(1);
    if (lastDs?.hash === h.all) {
      const durationMs = Date.now() - t0;
      await db.update(schema.syncRuns).set({ ...counts, status: "unchanged", finishedAt: new Date(), durationMs }).where(eq(schema.syncRuns.id, runId));
      return { status: "unchanged", runId, message: "Sheet-də dəyişiklik yoxdur.", durationMs, warnings };
    }

    // 4. Yaz (bir tranzaksiyada): CRM + bazar faktları, dəyişibsə yeni stok snapshot-u, hazır data paketi
    const [lastSnap] = await db.select().from(schema.stockSnapshots).orderBy(desc(schema.stockSnapshots.id)).limit(1);
    const now = new Date();
    await db.transaction(async (tx) => {
      const t = tx as unknown as DB;
      await t.delete(schema.crmFacts);
      const s0 = Math.round(Date.parse(crm.start) / 864e5), c = crm.cols;
      const facts = Array.from({ length: c.day.length }, (_, r) => ({
        day: isoDay(s0 + c.day[r]), cnt: c.cnt[r],
        ...Object.fromEntries(DIM_KEYS.map((k) => [k, crm.dims[k][c[k][r]]])) as Record<(typeof DIM_KEYS)[number], string>,
      }));
      await insertChunks(t, schema.crmFacts, facts, 4000);
      await t.delete(schema.marketFacts);
      await insertChunks(t, schema.marketFacts, market.rows.map(([m, b, md, n]) => ({ ym: market.months[m], brand: market.brands[b], model: market.models[md], cnt: n })), 5000);

      let takenAt = lastSnap?.takenAt ?? now;
      if (stockValues && lastSnap?.hash !== h.stock) {
        const [snap] = await t.insert(schema.stockSnapshots).values({ syncRunId: runId, hash: h.stock, rowCount: stock.length, takenAt: now }).returning({ id: schema.stockSnapshots.id });
        await insertChunks(t, schema.stockRows, stock.map((r, pos) => ({ ...r, snapshotId: snap.id, pos })), 1000);
        takenAt = now;
      }
      const payload = buildPayload(crm, market, stock, takenAt, h.bin, now);
      const [ds] = await t.insert(schema.datasets).values({ syncRunId: runId, hash: h.all, payload: JSON.stringify(payload) }).returning({ id: schema.datasets.id });
      // yalnız son 3 paket saxlanılır
      const keep = (await t.select({ id: schema.datasets.id }).from(schema.datasets).orderBy(desc(schema.datasets.id)).limit(3)).map((x) => x.id);
      await t.delete(schema.datasets).where(and(notInArray(schema.datasets.id, keep.length ? keep : [ds.id])));
    });

    const durationMs = Date.now() - t0;
    await db.update(schema.syncRuns).set({ ...counts, status: "ok", finishedAt: new Date(), durationMs }).where(eq(schema.syncRuns.id, runId));
    return { status: "ok", runId, message: `Yeniləndi: ${crm.records.toLocaleString("en-US")} CRM sətri, ${market.records.toLocaleString("en-US")} bazar sətri, ${stock.length} stok sətri.`, durationMs, warnings };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (runId !== undefined) {
      await db.update(schema.syncRuns).set({ status: "error", error: msg.slice(0, 2000), finishedAt: new Date(), durationMs: Date.now() - t0 })
        .where(eq(schema.syncRuns.id, runId)).catch(() => {});
    }
    return { status: "error", runId, message: msg, durationMs: Date.now() - t0 };
  } finally {
    await releaseLock(db).catch(() => {});
    // köhnə loqlar: 90 gündən köhnə "unchanged"/"skipped" qeydləri təmizlənir
    await db.delete(schema.syncRuns).where(and(inArray(schema.syncRuns.status, ["unchanged", "skipped"]), lt(schema.syncRuns.startedAt, sql`now() - interval '90 days'`))).catch(() => {});
  }
}
