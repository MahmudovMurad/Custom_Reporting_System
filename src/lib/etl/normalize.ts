// Normallaşdırma qaydaları — docs/legacy/sr_dashboard_template.html (norm, hnorm, vkey, parseDate, rsNum)
// və docs/legacy/sr_dashboard_build.py (_norm, RS_NUM) ilə birə-bir eyni olmalıdır.

/** İ→I, ı→i, trim, kiçik hərf */
export const norm = (s: unknown) => String(s ?? "").replace(/İ/g, "I").replace(/ı/g, "i").trim().toLowerCase();

/** Dəyər açarı: norm + çoxlu boşluq → bir boşluq ("E CLASS" = "E Class") */
export const vkey = (s: unknown) => norm(s).replace(/\s+/g, " ");

/** Başlıq açarı: vkey + Azərbaycan hərfləri latın ekvivalentinə ("Satış kanalı" = "satis kanali") */
export const hnorm = (s: unknown) =>
  norm(s).replace(/ə/g, "e").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g")
    .replace(/ö/g, "o").replace(/ü/g, "u").replace(/\s+/g, " ");

/** Daxili boşluqları sıxışdır + trim (bazar və stok adları üçün) */
export const squash = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

const MMM: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  yan: 0, fev: 1, iyn: 5, iyu: 5, iyl: 6, avq: 7, sen: 8, okt: 9, noy: 10, dek: 11,
};

/** Tarix → UTC gün indeksi (1970-01-01-dən günlər) və ya null. Formatlar: d-Mon-yy, YYYY-MM-DD, dd.mm.yyyy, m/d/yyyy, Sheets seriya nömrəsi */
export function parseDay(s: unknown): number | null {
  const t = parseDate(s);
  return t === null ? null : Math.round(t / 864e5);
}

export function parseDate(input: unknown): number | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  let m: RegExpMatchArray | null, y: number;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  if ((m = s.match(/^(\d{1,2})[-\s./]+([^\d\s.,/-]{3,})[-\s./,]+(\d{2,4})/))) {
    const mo = MMM[norm(m[2]).slice(0, 3)];
    if (mo === undefined) return null;
    y = +m[3]; if (y < 100) y += 2000;
    return Date.UTC(y, mo, +m[1]);
  }
  if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/))) { y = +m[3]; if (y < 100) y += 2000; return Date.UTC(y, +m[2] - 1, +m[1]); }
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) {
    const a = +m[1], b = +m[2]; y = +m[3]; if (y < 100) y += 2000;
    return a > 12 ? Date.UTC(y, b - 1, a) : Date.UTC(y, a - 1, b);   // default: ay/gün/il
  }
  if (/^\d{5}(\.\d+)?$/.test(s)) return Date.UTC(1899, 11, 30) + Math.floor(+s) * 864e5;   // Sheets seriya nömrəsi
  return null;
}

const AZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
const EN_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const monthIdx = (w: string) => {
  const k = hnorm(w).replace(/[^a-z]/g, "");
  if (k.length < 3) return -1;
  const f = (l: string[]) => l.findIndex((m) => hnorm(m).startsWith(k) || k.startsWith(hnorm(m)));
  const i = f(AZ_MONTHS);
  return i >= 0 ? i : f(EN_MONTHS);
};

/** Real Stock "Tarix" xanası → "YYYY-MM" (oxunmasa ""). Formatlar: tam tarix (parseDate), YYYY-MM, MM.YYYY, MM/YYYY, "Sentyabr 2026", "2026 Sentyabr" */
export function parseYm(input: unknown): string {
  const s = String(input ?? "").trim();
  if (!s) return "";
  const ym = (y: number, m: number) => (m >= 1 && m <= 12 && y >= 2000 && y < 2100 ? `${y}-${String(m).padStart(2, "0")}` : "");
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})[-./](\d{1,2})$/))) return ym(+m[1], +m[2]);
  if ((m = s.match(/^(\d{1,2})[-./](\d{4})$/))) return ym(+m[2], +m[1]);
  if ((m = s.match(/^([^\d\s.,/-]+)[\s.,/-]+(\d{2,4})$/))) { const i = monthIdx(m[1]); const y = +m[2] < 100 ? +m[2] + 2000 : +m[2]; return i < 0 ? "" : ym(y, i + 1); }
  if ((m = s.match(/^(\d{4})[\s.,/-]+([^\d\s.,/-]+)$/))) { const i = monthIdx(m[2]); return i < 0 ? "" : ym(+m[1], i + 1); }
  const t = parseDate(s);
  if (t === null) return "";
  const d = new Date(t);
  return ym(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

/** "28,900.00 ₼" · "65.900.00 ₼" · "2890" · "10%" → ədəd. Sonuncu ayırıcıdan sonra 1–2 rəqəm = onluq hissə */
export function rsNum(s: unknown): number | null {
  const t = String(s ?? "").replace(/[^\d.,]/g, "");
  if (!t) return null;
  const m = t.match(/[.,](\d{1,2})$/);
  const whole = (m ? t.slice(0, m.index) : t).replace(/[.,]/g, "");
  return whole ? +(whole + (m ? "." + m[1] : "")) : null;
}

export const rsInt = (s: unknown) => { const v = rsNum(s); return v == null ? 0 : Math.round(v); };

export const isoDay = (day: number) => new Date(day * 864e5).toISOString().slice(0, 10);
