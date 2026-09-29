// Main Data → CRM (gün × Brend × Model × Növ × Kanal × Satış kanalı × Haradan Gəlib üzrə say) + bazar (ay × Brend × Model).
// Qaydalar: template buildFromCSV + build.py load_sheet_csv / load_export (handoff §4.1, §4.3).
import { hnorm, norm, parseDay, squash, vkey } from "./normalize";

export const DIM_KEYS = ["brand", "model", "nov", "kanal", "satis", "haradan"] as const;
export type DimKey = (typeof DIM_KEYS)[number];

const SHEET_COLS: Record<"date" | DimKey, string[]> = {
  date: ["date", "tarix"], brand: ["brend", "brand", "marka"], model: ["model"], nov: ["nov", "type", "tip"],
  kanal: ["kanal", "channel"], haradan: ["haradan gelib", "traffic channel"], satis: ["satis kanali", "sales channel"],
};
// Paneldə istifadə olunmayan, amma tanınan sütunlar (xəbərdarlıq verilmir)
const KNOWN_UNUSED = ["muraciet novu", "cash/credit"];
// Kanal sütunu öz Növ-ündə boşdursa "(boş)" yazılır; başqa Növ-lərdə boş qalır
const CHANNEL_NOV: Partial<Record<DimKey, string[]>> = {
  kanal: ["müraciət", "muraciet"], haradan: ["trafik", "traffic"], satis: ["sales", "satış", "satis"],
};
const MARKET_NOV = "market sales split";
const NOV_ORDER = [["müraciət", "muraciet"], ["trafik", "traffic"], ["sales", "satış", "satis"]];

export type CrmData = {
  records: number;            // CRM sətirləri (bazar sətirləri xaric)
  skipped: number;            // tarixi oxunmayan sətirlər
  start: string;              // ilk gün (YYYY-MM-DD)
  ndays: number;
  dims: Record<DimKey, string[]>;   // 0 = "" (boş); qalanı ümumi saya görə azalan, Növ-də Müraciət/Trafik/Sales əvvəldə
  // sütunlu cəmlənmiş sətirlər (günə görə sıralı)
  cols: { day: Uint16Array; cnt: Uint32Array } & Record<DimKey, Uint16Array>;
  novTotals: Record<string, number>;
};
export type MarketData = {
  records: number;
  months: string[]; brands: string[]; models: string[];
  rows: [number, number, number, number][];   // [ay, brend, model, say]
};

export function buildMainData(values: string[][]): { crm: CrmData; market: MarketData; warnings: string[] } {
  const warnings: string[] = [];
  const header = (values[0] || []).map(hnorm);
  const ix = {} as Record<"date" | DimKey, number>;
  for (const k of Object.keys(SHEET_COLS) as ("date" | DimKey)[]) ix[k] = header.findIndex((h) => SHEET_COLS[k].includes(h));
  const miss = (["date", "nov"] as const).filter((k) => ix[k] < 0);
  if (miss.length) throw new Error(`Main Data-da "Date" və "Növ" sütunları tapılmadı. Başlıq: ${(values[0] || []).slice(0, 10).join(", ")}`);
  for (const k of DIM_KEYS) if (ix[k] < 0) warnings.push(`Main Data: "${k}" sütunu tapılmadı — boş sayılır`);
  const used = new Set(Object.values(ix).filter((i) => i >= 0));
  header.forEach((h, i) => { if (h && !used.has(i) && !KNOWN_UNUSED.includes(h)) warnings.push(`Main Data: tanınmayan sütun "${values[0][i]}"`); });

  // dəyər lüğətləri: vkey → kod; hər kod üçün yazılış sayları (ən çox işlənən göstərilir)
  const dict = {} as Record<DimKey, Map<string, number>>, spell = {} as Record<DimKey, Map<string, number>[]>;
  for (const k of DIM_KEYS) { dict[k] = new Map([["", 0]]); spell[k] = [new Map([["", 1]])]; }
  const agg = new Map<string, number>();
  const mk = new Map<string, number>();
  let skipped = 0, records = 0, mkRecords = 0, minD = Infinity, maxD = -Infinity;

  for (let r = 1; r < values.length; r++) {
    const f = values[r];
    if (!f || f.every((x) => !String(x ?? "").trim())) continue;
    const day = parseDay(f[ix.date]);
    if (day === null) { skipped++; continue; }
    const nv = norm(f[ix.nov]);
    if (nv === MARKET_NOV) {                              // bazar sətri: hər sətir = 1 satılmış avtomobil
      const brand = squash(ix.brand >= 0 ? f[ix.brand] : "");
      if (!brand) continue;
      const model = squash(ix.model >= 0 ? f[ix.model] : "") || "(model yoxdur)";
      const d = new Date(day * 864e5), ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const key = ym + "\u0000" + brand + "\u0000" + model;
      mk.set(key, (mk.get(key) || 0) + 1); mkRecords++;
      continue;
    }
    let key = String(day);
    for (const k of DIM_KEYS) {
      let v = ix[k] >= 0 ? String(f[ix[k]] ?? "").trim() : "";
      if (!v && CHANNEL_NOV[k]?.includes(nv)) v = "(boş)";
      const kk = vkey(v);
      let c = dict[k].get(kk);
      if (c === undefined) { c = spell[k].length; dict[k].set(kk, c); spell[k].push(new Map()); }
      const sp = spell[k][c]; sp.set(v, (sp.get(v) || 0) + 1);
      key += "|" + c;
    }
    agg.set(key, (agg.get(key) || 0) + 1); records++;
    if (day < minD) minD = day;
    if (day > maxD) maxD = day;
  }
  if (!records) throw new Error("Main Data-da tarixi oxuna bilən CRM sətri tapılmadı.");

  // ən çox işlənən yazılış (bərabərlikdə ilk rast gəlinən)
  const label = {} as Record<DimKey, string[]>;
  for (const k of DIM_KEYS) label[k] = spell[k].map((m) => { let best = "", n = -1; m.forEach((c, v) => { if (c > n) { n = c; best = v; } }); return best; });

  // cəmlənmiş sətirlər + hər kodun ümumi sayı
  const tmp: number[][] = [];
  const tot = {} as Record<DimKey, Float64Array>;
  for (const k of DIM_KEYS) tot[k] = new Float64Array(spell[k].length);
  for (const [k, c] of agg) {
    const a = k.split("|").map(Number); a.push(c); tmp.push(a);
    DIM_KEYS.forEach((d, j) => { tot[d][a[j + 1]] += c; });
  }
  // kodları yenidən sırala: 0 = "", sonra saya görə azalan (Növ-də Müraciət/Trafik/Sales əvvəl) — build.py pack() kimi
  const dims = {} as Record<DimKey, string[]>, remap = {} as Record<DimKey, Int32Array>;
  for (const k of DIM_KEYS) {
    let order = label[k].map((_, i) => i).filter((i) => i > 0 && tot[k][i] > 0 && label[k][i] !== "");
    order.sort((a, b) => tot[k][b] - tot[k][a] || a - b);
    if (k === "nov") {
      const first = NOV_ORDER.map((names) => order.find((i) => names.includes(norm(label[k][i])))).filter((i): i is number => i !== undefined);
      order = [...first, ...order.filter((i) => !first.includes(i))];
    }
    remap[k] = new Int32Array(label[k].length);                 // köhnə kod → yeni kod ("" və görünməyənlər → 0)
    order.forEach((old, j) => { remap[k][old] = j + 1; });
    dims[k] = ["", ...order.map((i) => label[k][i])];
    if (dims[k].length > (k === "model" ? 65535 : 255)) throw new Error(`${k}: çox dəyər (${dims[k].length})`);
  }
  tmp.sort((a, b) => a[0] - b[0]);
  const n = tmp.length;
  const cols = { day: new Uint16Array(n), cnt: new Uint32Array(n) } as CrmData["cols"];
  for (const k of DIM_KEYS) cols[k] = new Uint16Array(n);
  tmp.forEach((a, r) => {
    cols.day[r] = a[0] - minD;
    DIM_KEYS.forEach((k, j) => { cols[k][r] = remap[k][a[j + 1]]; });
    cols.cnt[r] = a[7];
  });
  const novTotals: Record<string, number> = {};
  dims.nov.forEach((v, i) => { if (i) novTotals[v] = 0; });
  for (let r = 0; r < n; r++) if (cols.nov[r]) novTotals[dims.nov[cols.nov[r]]] += cols.cnt[r];

  // bazar: aylar sıralı, brend/model sıralı açar ardıcıllığı ilə (build.py load_export → load_market kimi)
  const keys = [...mk.keys()].sort();
  const months: string[] = [], brands: string[] = [], models: string[] = [];
  const mi = new Map<string, number>(), bi = new Map<string, number>(), di = new Map<string, number>();
  const idx = (m: Map<string, number>, arr: string[], v: string) => { let i = m.get(v); if (i === undefined) { i = arr.length; arr.push(v); m.set(v, i); } return i; };
  const rawRows = keys.map((key) => { const [ym, b, md] = key.split("\u0000"); return [idx(mi, months, ym), idx(bi, brands, b), idx(di, models, md), mk.get(key)!] as [number, number, number, number]; });
  const ms = [...months].sort(), mRemap = months.map((m) => ms.indexOf(m));
  const market: MarketData = { records: mkRecords, months: ms, brands, models, rows: rawRows.map(([m, b, md, c]) => [mRemap[m], b, md, c]) };

  return {
    crm: { records, skipped, start: new Date(minD * 864e5).toISOString().slice(0, 10), ndays: maxD - minD + 1, dims, cols, novTotals },
    market, warnings,
  };
}
