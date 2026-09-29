// Dırnaqlı sahələri dəstəkləyən CSV parser (template parseCSV ilə eyni) — Sheet-in "Download → CSV" exportu üçün
export function parseCSV(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  const n = text.length;
  let row: string[] = [], f = "", i = 0, q = false;
  while (i < n) {
    const c = text.charCodeAt(i);
    if (q) {
      if (c === 34) { if (text.charCodeAt(i + 1) === 34) { f += '"'; i += 2; } else { q = false; i++; } continue; }
      let j = text.indexOf('"', i); if (j < 0) j = n; f += text.slice(i, j); i = j; continue;
    }
    if (c === 34) { q = true; i++; continue; }
    if (c === 44) { row.push(f); f = ""; i++; continue; }
    if (c === 10 || c === 13) { row.push(f); rows.push(row); row = []; f = ""; i += (c === 13 && text.charCodeAt(i + 1) === 10) ? 2 : 1; continue; }
    let j = i;
    while (j < n) { const d = text.charCodeAt(j); if (d === 44 || d === 10 || d === 13 || d === 34) break; j++; }
    f += text.slice(i, j); i = j;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows;
}
