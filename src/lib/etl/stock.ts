// Real Stock vərəqi → stok sətirləri. Qaydalar: template parseRealStock + build.py load_real_stock (handoff §4.2, §4.3).
import { hnorm, rsInt, rsNum, squash } from "./normalize";

export type StockRow = {
  brand: string; model: string; version: string; year: number | null;
  price: number | null; faiz: number | null; ilkin: number | null; muddet: string; ayliq: number | null;
  stok: number; real: number; hedef: number; actual: number; beh: number; qeyd: string;
};

// Başlıq + alternativ yazılışlar (hnorm ilə müqayisə olunur: böyük/kiçik hərf və ə/ş/ç... fərqi yoxdur)
const HEADERS: Record<keyof StockRow, string[]> = {
  brand: ["Brend adı"], model: ["Model adı"], version: ["Model növü"], year: ["İstehsal ili"],
  price: ["Nağd qiymət"], faiz: ["Faiz"], ilkin: ["İlkin ödəniş"], muddet: ["Müddət"], ayliq: ["Aylıq ödəniş"],
  stok: ["Stok sayı"], real: ["Real Stok", "Real stock"], hedef: ["Hədəf"],
  actual: ["Actual Satış", "Satış"], beh: ["Beh Sayı", "Beh"], qeyd: ["Qeyd"],
};
const REQUIRED: (keyof StockRow)[] = ["brand", "model", "stok", "real", "hedef", "actual", "beh"];
const OPTIONAL: (keyof StockRow)[] = ["qeyd"];

export function parseRealStock(values: string[][]): { rows: StockRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const hdr = (values[0] || []).map(hnorm);
  const col = {} as Record<keyof StockRow, number>;
  for (const k of Object.keys(HEADERS) as (keyof StockRow)[]) {
    col[k] = -1;
    for (const h of HEADERS[k]) { const i = hdr.indexOf(hnorm(h)); if (i >= 0) { col[k] = i; break; } }
    if (col[k] < 0 && !OPTIONAL.includes(k)) {
      warnings.push(`Real Stock: "${HEADERS[k][0]}" sütunu tapılmadı${REQUIRED.includes(k) ? "" : " — boş sayılır"}`);
    }
  }
  if (col.model < 0) throw new Error(`Real Stock-da "Model adı" sütunu tapılmadı. Başlıq: ${(values[0] || []).join(", ")}`);
  const used = new Set(Object.values(col).filter((i) => i >= 0));
  hdr.forEach((h, i) => { if (h && !used.has(i)) warnings.push(`Real Stock: tanınmayan sütun "${values[0][i]}"`); });

  const rows: StockRow[] = [];
  let brand = "", model = "";
  for (let r = 1; r < values.length; r++) {
    const f = values[r] || [];
    const g = (k: keyof StockRow) => (col[k] >= 0 ? String(f[col[k]] ?? "").trim() : "");
    brand = squash(g("brand")) || brand;                 // Brend adı / Model adı yalnız qrupun ilk sətrindədir
    model = squash(g("model")) || model;
    const version = g("version"), nums = (["stok", "real", "hedef", "actual", "beh"] as const).map(g);
    if (!model || (!version && !nums.some((v) => v))) continue;
    let mud = g("muddet").replace(/\s+/g, " ").trim();
    mud = /^cash$/i.test(mud) ? "Cash" : mud.replace(/^(\d+)\s*[Aa][YyıI]?$/i, "$1 ay");
    const year = g("year");
    rows.push({
      brand, model, version, year: /^\d{4}$/.test(year) ? +year : null,
      price: rsNum(g("price")), faiz: rsNum(g("faiz")), ilkin: rsNum(g("ilkin")), muddet: mud, ayliq: rsNum(g("ayliq")),
      stok: rsInt(g("stok")), real: rsInt(g("real")), hedef: rsInt(g("hedef")), actual: rsInt(g("actual")),
      beh: rsInt(g("beh")), qeyd: g("qeyd"),
    });
  }
  return { rows, warnings };
}
