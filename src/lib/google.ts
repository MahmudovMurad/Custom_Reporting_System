// Google servis hesabı (JWT) ilə Sheets API — yalnız oxuma icazəsi.
// Açar: GOOGLE_SERVICE_ACCOUNT_KEY env (JSON mətni və ya base64) — yoxdursa lokal .secrets/google-sa.json.
import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

type ServiceAccount = { client_email: string; private_key: string };
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const LOCAL_KEY = ".secrets/google-sa.json";

function loadKey(): ServiceAccount {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
  if (raw && !raw.startsWith("{")) raw = Buffer.from(raw, "base64").toString("utf8");
  if (!raw && existsSync(LOCAL_KEY)) raw = readFileSync(LOCAL_KEY, "utf8");
  if (!raw) throw new Error("Google servis hesabı açarı yoxdur (GOOGLE_SERVICE_ACCOUNT_KEY və ya .secrets/google-sa.json)");
  const k = JSON.parse(raw) as ServiceAccount;
  if (!k.client_email || !k.private_key) throw new Error("Servis hesabı açarında client_email / private_key yoxdur");
  return k;
}

export const serviceAccountEmail = () => loadKey().client_email;

let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const key = loadKey();
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: key.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  const j = await res.json() as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !j.access_token) throw new Error(`Google token alınmadı: ${j.error_description || j.error || res.status}`);
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, { headers: { authorization: `Bearer ${await accessToken()}` } });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403 || res.status === 404) {
      throw new Error(`Sheet-ə giriş yoxdur (${res.status}). Sheet servis hesabı ilə (${serviceAccountEmail()}) "Viewer" kimi paylaşılmalıdır.`);
    }
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export type SheetInfo = { sheetId: number; title: string; rowCount: number; columnCount: number };

export async function sheetList(spreadsheetId: string): Promise<SheetInfo[]> {
  const j = await api<{ sheets: { properties: { sheetId: number; title: string; gridProperties: { rowCount: number; columnCount: number } } }[] }>(
    `${spreadsheetId}?fields=sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))`);
  return j.sheets.map(({ properties: p }) => ({ sheetId: p.sheetId, title: p.title, rowCount: p.gridProperties.rowCount, columnCount: p.gridProperties.columnCount }));
}

const colName = (n: number) => { let s = ""; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

/** Vərəqi ekranda göründüyü kimi (FORMATTED_VALUE — köhnə paneldəki CSV exportu ilə eyni) hissə-hissə oxuyur. */
export async function readSheet(spreadsheetId: string, sheet: SheetInfo, chunkRows = 40000, parallel = 4): Promise<string[][]> {
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const last = colName(Math.max(1, sheet.columnCount));
  const ranges: string[] = [];
  for (let a = 1; a <= sheet.rowCount; a += chunkRows) ranges.push(`${q(sheet.title)}!A${a}:${last}${Math.min(sheet.rowCount, a + chunkRows - 1)}`);
  const out: string[][][] = new Array(ranges.length);
  for (let i = 0; i < ranges.length; i += parallel) {
    const batch = ranges.slice(i, i + parallel);
    const params = batch.map((r) => "ranges=" + encodeURIComponent(r)).join("&");
    const j = await api<{ valueRanges: { values?: string[][] }[] }>(
      `${spreadsheetId}/values:batchGet?${params}&valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`);
    j.valueRanges.forEach((vr, k) => { out[i + k] = vr.values ?? []; });
  }
  // hissələr ardıcıl birləşdirilir; hər hissənin sonundakı boş sətirləri API atır — sətir nömrəsi vacib deyil
  return out.flat();
}
