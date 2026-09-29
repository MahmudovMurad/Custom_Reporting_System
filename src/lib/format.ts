// Brauzerlərin "az" lokal datası natamamdır ("2026 M09 28") — ay adları köhnə paneldəki kimi əl ilə
export const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
export const MON3 = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"];

const p2 = (n: number) => String(n).padStart(2, "0");

/** "28 sen 2026, 17:29" (brauzerin yerli vaxtı ilə) */
export const dateTimeShort = (d: Date) => `${d.getDate()} ${MON3[d.getMonth()]} ${d.getFullYear()}, ${p2(d.getHours())}:${p2(d.getMinutes())}`;

/** Server tərəfdə (Vercel UTC-dədir) Bakı vaxtı ilə: "29 sen 2026, 12:45" */
export function bakuDateTime(d: Date): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Baku", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${+p.day} ${MON3[+p.month - 1]} ${p.year}, ${p.hour}:${p.minute}`;
}

/** "2026-09-28" → "28 sentyabr 2026" */
export const isoLong = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
