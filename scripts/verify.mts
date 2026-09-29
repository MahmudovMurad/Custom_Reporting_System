// Handoff §6 qəbul testləri — DB-dəki data ilə köhnə panelin rəqəmlərini müqayisə edir.
//   npm run verify
// (Sheet yenilənibsə rəqəmlər dəyişə bilər — müqayisə eyni snapshot üzərində aparılmalıdır.)
import "dotenv/config";
import { desc, eq } from "drizzle-orm";
import { connect } from "../src/db/connect";
import * as schema from "../src/db/schema";
import { norm, vkey } from "../src/lib/etl/normalize";

const OUR = ["Changan", "Lynk & Co", "Mercedes", "Skoda", "Xpeng", "Avatr", "Leap", "Deepal"].map(norm);   // template CFG.ourBrands
const MKT = new Set(["Facebook", "Instagram", "Whatsapp", "Tiktok", "Call", "Call Center", "Sosial Şəbəkə", "Changan.az", "Skoda.az", "Avatr.az", "İnternet", "Youtube", "Google", "Tv"].map(vkey));

const { db, close } = await connect();
let fails = 0;
const check = (name: string, got: string | number, want: string | number) => {
  const ok = String(got) === String(want);
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${got}${ok ? "" : `   (gözlənilən: ${want})`}`);
};
const f = (n: number) => n.toLocaleString("en-US");
const p1 = (a: number, b: number) => (b ? (a / b * 100).toFixed(1) + "%" : "—");

try {
  const crm = await db.select().from(schema.crmFacts);
  const mk = await db.select().from(schema.marketFacts);
  const [snap] = await db.select().from(schema.stockSnapshots).orderBy(desc(schema.stockSnapshots.id)).limit(1);
  const st = snap ? await db.select().from(schema.stockRows).where(eq(schema.stockRows.snapshotId, snap.id)) : [];

  const nov = (n: string) => crm.filter((r) => norm(r.nov) === n).reduce((a, r) => a + r.cnt, 0);
  const total = crm.reduce((a, r) => a + r.cnt, 0);
  console.log("— Main Data");
  check("CRM sətri", f(total), "229,687");
  check("Müraciət", f(nov("müraciət")), "200,016");
  check("Trafik", f(nov("trafik")), "25,980");
  check("Satış", f(nov("sales")), "3,691");
  check("Satış from Marketing", f(crm.filter((r) => norm(r.nov) === "sales" && MKT.has(vkey(r.satis))).reduce((a, r) => a + r.cnt, 0)), "398");
  check("Traffic from Marketing", f(crm.filter((r) => norm(r.nov) === "trafik" && MKT.has(vkey(r.haradan))).reduce((a, r) => a + r.cnt, 0)), "5,890");

  console.log("— Bazar");
  const mkTotal = mk.reduce((a, r) => a + r.cnt, 0);
  check("Bazar sətri", f(mkTotal), "21,610");
  const months = [...new Set(mk.map((r) => r.ym))].sort();
  console.log(`      aylar: ${months[0]} – ${months[months.length - 1]}`);

  // CRM rəsmi satış (Növ=Sales) bazar aylarında, brend/model adları norm ilə
  const sales = crm.filter((r) => norm(r.nov) === "sales" && months.includes(r.day.slice(0, 7)));
  const off = (bOk: (b: string) => boolean, model?: string) => sales.filter((r) => bOk(norm(r.brand)) && (!model || norm(r.model) === norm(model))).reduce((a, r) => a + r.cnt, 0);
  const mkt = (bOk: (b: string) => boolean, model?: string) => mk.filter((r) => bOk(norm(r.brand)) && (!model || norm(r.model) === norm(model))).reduce((a, r) => a + r.cnt, 0);
  // grey = aylıq max(0, bazar − rəsmi)
  const grey = (bOk: (b: string) => boolean) => months.reduce((a, ym) => {
    const m = mk.filter((r) => r.ym === ym && bOk(norm(r.brand))).reduce((s, r) => s + r.cnt, 0);
    const o = sales.filter((r) => r.day.startsWith(ym) && bOk(norm(r.brand))).reduce((s, r) => s + r.cnt, 0);
    return a + Math.max(0, m - o);
  }, 0);
  const ours = (b: string) => OUR.includes(b), rivals = (b: string) => !OUR.includes(b), all = () => true;
  const mkBrands = new Set(mk.map((r) => norm(r.brand)));
  const inMk = (b: string) => mkBrands.has(b);
  const changan = (b: string) => b === "changan";

  console.log("— Bazarla müqayisə (bazar ayları)");
  check("Bizim brendlər CRM / bazar", `${f(off(ours))} / ${f(mkt(ours))} → ${p1(off(ours), mkt(ours))}`, "1,241 / 12,476 → 9.9%");
  check("Changan", `${f(off(changan))} / ${f(mkt(changan))} → ${p1(off(changan), mkt(changan))}`, "946 / 11,780 → 8.0%");
  check("Changan UNI-Z", `${f(off(changan, "UNI-Z"))} / ${f(mkt(changan, "UNI-Z"))} → ${p1(off(changan, "UNI-Z"), mkt(changan, "UNI-Z"))}`, "190 / 3,681 → 5.2%");

  console.log("— Market Share (bütün dövr)");
  check("Total/Total", `${p1(mkt(ours), mkTotal)} / ${p1(mkt(rivals), mkTotal)}`, "57.7% / 42.3%");
  check("Bizim rəsmi / grey", `${p1(off(ours), mkTotal)} / ${p1(grey(ours), mkTotal)}`, "5.7% / 52.0%");
  const greyMarket = months.reduce((a, ym) => {
    const m = mk.filter((r) => r.ym === ym).reduce((s, r) => s + r.cnt, 0);
    const o = sales.filter((r) => r.day.startsWith(ym) && inMk(norm(r.brand))).reduce((s, r) => s + r.cnt, 0);
    return a + Math.max(0, m - o);
  }, 0);
  check("Grey bazar", `${f(greyMarket)} = ${f(mkTotal)} − ${f(off((b) => inMk(b)))}`, "20,369 = 21,610 − 1,241");
  check("Grey/Grey", `${p1(grey(ours), greyMarket)} / ${p1(grey(rivals), greyMarket)}`, "55.2% / 44.8%");
  const cO = off(changan), cG = grey(changan);
  check("Changan Rəsmi vs Grey, qalan", `${p1(cO, mkTotal)} / ${p1(cG, mkTotal)}, ${(100 - cO / mkTotal * 100 - cG / mkTotal * 100).toFixed(1)}%`, "4.4% / 50.1%, 45.5%");
  const uz = mkt(changan, "UNI-Z"), byd = mkt((b) => b === "byd");
  check("Changan UNI-Z vs BYD, digər", `${p1(uz, mkTotal)} / ${p1(byd, mkTotal)}, ${(100 - (uz + byd) / mkTotal * 100).toFixed(1)}%`, "17.0% / 15.1%, 67.8%");
  void all;

  console.log("— Real Stock");
  const s = (k: "hedef" | "actual" | "beh" | "stok" | "real") => st.reduce((a, r) => a + r[k], 0);
  console.log(`      ${st.length} sətir (gözlənilən 53–54)`);
  check("Model / Hədəf / Satış / Beh / Stok / Real", `${new Set(st.map((r) => r.brand + "|" + r.model)).size} / ${s("hedef")} / ${s("actual")} / ${s("beh")} / ${s("stok")} / ${s("real")}`, "31 / 337 / 160 / 101 / 686 / 418");

  console.log(fails ? `\n${fails} yoxlama fərqlidir (Sheet 25–28.09 snapshot-undan sonra dəyişibsə, bu gözləniləndir).` : "\nBütün yoxlamalar keçdi.");
} finally {
  await close();
}
