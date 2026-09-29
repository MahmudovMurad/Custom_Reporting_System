// Panelə (brauzerə) verilən kompakt data paketi — köhnə panelin __DATA__ formatının davamı.
// CRM sütunlu binar formatdadır (gzip + base64): [cnt u32 × n][day u16 × n][brand, model, nov, kanal, satis, haradan: u16 × n], little-endian.
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { DIM_KEYS, type CrmData, type MarketData } from "./crm";
import type { StockRow } from "./stock";

export const PAYLOAD_VERSION = 1;

export type Payload = {
  v: number;
  syncedAt: string;
  crm: { start: string; ndays: number; n: number; records: number; skipped: number; dims: CrmData["dims"]; blob: string };
  market: Omit<MarketData, "records"> & { records: number };
  stock: { takenAt: string; rows: StockRow[] };
};

export function crmBinary(crm: CrmData): Buffer {
  const n = crm.cols.day.length;
  const parts: Buffer[] = [Buffer.from(crm.cols.cnt.buffer, crm.cols.cnt.byteOffset, n * 4), Buffer.from(crm.cols.day.buffer, crm.cols.day.byteOffset, n * 2)];
  for (const k of DIM_KEYS) parts.push(Buffer.from(crm.cols[k].buffer, crm.cols[k].byteOffset, n * 2));
  return Buffer.concat(parts);
}

const sha = (...parts: (string | Buffer)[]) => { const h = createHash("sha256"); parts.forEach((p) => h.update(p)); return h.digest("hex"); };

export function hashes(crm: CrmData, market: MarketData, stock: StockRow[]) {
  const bin = crmBinary(crm);
  const crmH = sha(bin, JSON.stringify([crm.start, crm.dims, crm.records, crm.skipped]));
  const marketH = sha(JSON.stringify(market));
  const stockH = sha(JSON.stringify(stock));
  return { bin, crm: crmH, market: marketH, stock: stockH, all: sha(crmH, marketH, stockH) };
}

export function buildPayload(crm: CrmData, market: MarketData, stock: StockRow[], stockTakenAt: Date, bin: Buffer, syncedAt: Date): Payload {
  return {
    v: PAYLOAD_VERSION,
    syncedAt: syncedAt.toISOString(),
    crm: { start: crm.start, ndays: crm.ndays, n: crm.cols.day.length, records: crm.records, skipped: crm.skipped, dims: crm.dims, blob: gzipSync(bin, { level: 9 }).toString("base64") },
    market,
    stock: { takenAt: stockTakenAt.toISOString(), rows: stock },
  };
}
