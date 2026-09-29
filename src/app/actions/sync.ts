"use server";

import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/dal";
import { runSync, type SyncResult } from "@/lib/sync";

// "Yenilə" düyməsi — yalnız admin (istifadəçi qərarı, handoff §8 sual 3). Son 60 saniyədə sync olubsa təkrar oxunmur.
export async function triggerSync(): Promise<SyncResult> {
  const me = await requireAdmin();
  return runSync(await getDb(), { trigger: "manual", userId: me.id, minIntervalSec: 60 });
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
