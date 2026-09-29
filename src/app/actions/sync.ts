"use server";

import { desc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/dal";
import type { SyncResult } from "@/lib/sync";

// "Yenilə" — yalnız admin (istifadəçi qərarı, handoff §8 sual 3).
// Server Sheet-i özü oxuya bilmir (servis hesabı açarı qadağandır) — Sheet-in Apps Script web app-ına "indi göndər" deyir,
// o da datanı /api/ingest-ə göndərir və nəticəni qaytarır.
export async function triggerSync(): Promise<SyncResult> {
  const me = await requireAdmin();
  const url = process.env.APPS_SCRIPT_URL?.trim(), secret = process.env.SYNC_SECRET?.trim();
  if (!url || !secret) return { status: "error", message: "Apps Script web app qoşulmayıb (APPS_SCRIPT_URL). Sheet-də “SR Reporting → İndi göndər” menyusundan istifadə edin." };

  const db = await getDb();
  const [last] = await db.select({ at: schema.syncRuns.finishedAt }).from(schema.syncRuns)
    .where(inArray(schema.syncRuns.status, ["ok", "unchanged"])).orderBy(desc(schema.syncRuns.id)).limit(1);
  if (last?.at && Date.now() - last.at.getTime() < 60_000) {
    return { status: "skipped", message: `Son yoxlama ${Math.round((Date.now() - last.at.getTime()) / 1000)} saniyə əvvəl olub — bir az sonra yenidən cəhd edin.` };
  }
  try {
    const res = await fetch(url, {
      method: "POST", redirect: "follow", signal: AbortSignal.timeout(280_000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: secret, requestedBy: me.id }),
    });
    const text = await res.text();
    let j: { ok?: boolean; message?: string; result?: SyncResult };
    try { j = JSON.parse(text); } catch { return { status: "error", message: `Apps Script gözlənilməz cavab qaytardı (${res.status}).` }; }
    if (j.result) return j.result;
    return { status: j.ok ? "ok" : "error", message: j.message || "Apps Script cavab verdi." };
  } catch (e) {
    return { status: "error", message: `Apps Script-ə qoşulmaq alınmadı: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export type SyncRunRow = {
  id: number; trigger: string; status: string; startedAt: string; durationMs: number | null;
  crmRecords: number | null; marketRecords: number | null; stockRows: number | null; dataEnd: string | null;
  warnings: string[]; error: string | null;
};

export async function listSyncRuns(limit = 30): Promise<SyncRunRow[]> {
  await requireAdmin();
  const db = await getDb();
  const rows = await db.select().from(schema.syncRuns).orderBy(desc(schema.syncRuns.id)).limit(Math.min(100, limit));
  return rows.map((r) => ({
    id: r.id, trigger: r.trigger, status: r.status, startedAt: r.startedAt.toISOString(), durationMs: r.durationMs,
    crmRecords: r.crmRecords, marketRecords: r.marketRecords, stockRows: r.stockRows, dataEnd: r.dataEnd,
    warnings: r.warnings, error: r.error,
  }));
}
