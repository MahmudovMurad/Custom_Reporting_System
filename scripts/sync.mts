// Sync-i Sheet-in CSV exportlarından işə salır (lokal inkişaf / qəbul testləri). DATABASE_URL yoxdursa lokal PGlite.
//   npm run sync -- --main "Main Data.csv" --stock "Real Stock.csv"
// CSV: Google Sheets → File → Download → Comma-separated values (hər vərəq ayrıca). Defolt yer: .data/import/
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { connect } from "../src/db/connect";
import { parseCSV } from "../src/lib/etl/csv";
import { runSync } from "../src/lib/sync";

const { values } = parseArgs({ options: { main: { type: "string", default: ".data/import/main.csv" }, stock: { type: "string", default: ".data/import/stock.csv" } } });
if (!existsSync(values.main!)) { console.error(`Fayl tapılmadı: ${values.main}`); process.exit(1); }
const stockFile = existsSync(values.stock!) ? values.stock! : null;

const { db, close, kind } = await connect();
try {
  console.log(`Sync başlayır (${kind})…`);
  const r = await runSync(db, {
    trigger: "cli",
    source: async () => ({
      main: parseCSV(readFileSync(values.main!, "utf8")),
      stock: stockFile ? parseCSV(readFileSync(stockFile, "utf8")) : null,
      warnings: stockFile ? [] : [`Real Stock CSV-si verilmədi — stok yenilənmədi`],
    }),
  });
  console.log(`${r.status}: ${r.message} (${((r.durationMs ?? 0) / 1000).toFixed(1)} s)`);
  r.warnings?.forEach((w) => console.log("  ! " + w));
  if (r.status === "error") process.exitCode = 1;
} finally {
  await close();
}
