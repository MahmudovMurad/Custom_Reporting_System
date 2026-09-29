// Sync-i terminaldan işə salır (test / ilk yükləmə). DATABASE_URL yoxdursa lokal PGlite.
//   npm run sync            — nəticə + §6 yoxlama rəqəmləri
import "dotenv/config";
import { desc } from "drizzle-orm";
import { connect } from "../src/db/connect";
import * as schema from "../src/db/schema";
import { runSync } from "../src/lib/sync";

const { db, close, kind } = await connect();
try {
  console.log(`Sync başlayır (${kind})…`);
  const r = await runSync(db, { trigger: "cli" });
  console.log(`${r.status}: ${r.message} (${((r.durationMs ?? 0) / 1000).toFixed(1)} s)`);
  r.warnings?.forEach((w) => console.log("  ! " + w));
  const [ds] = await db.select({ payload: schema.datasets.payload }).from(schema.datasets).orderBy(desc(schema.datasets.id)).limit(1);
  if (ds) {
    const p = JSON.parse(ds.payload);
    const [run] = await db.select().from(schema.syncRuns).orderBy(desc(schema.syncRuns.id)).limit(1);
    const st = p.stock.rows as { model: string; brand: string; hedef: number; actual: number; beh: number; stok: number; real: number }[];
    const sum = (k: keyof (typeof st)[number]) => st.reduce((a, x) => a + (x[k] as number), 0);
    console.log(`\nYoxlama (handoff §6):`);
    console.log(`  CRM sətri: ${p.crm.records.toLocaleString("en-US")} · aralıq ${run.dataStart} – ${run.dataEnd} · cəmlənmiş ${p.crm.n.toLocaleString("en-US")}`);
    console.log(`  Bazar sətri: ${p.market.records.toLocaleString("en-US")} · ${p.market.months.length} ay · ${p.market.brands.length} brend`);
    console.log(`  Real Stock: ${st.length} sətir · ${new Set(st.map((x) => x.brand + "|" + x.model)).size} model · Hədəf ${sum("hedef")} · Satış ${sum("actual")} · Beh ${sum("beh")} · Stok ${sum("stok")} · Real Stok ${sum("real")}`);
  }
} finally {
  await close();
}
