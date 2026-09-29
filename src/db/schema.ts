import { sql } from "drizzle-orm";
import { boolean, check, date, doublePrecision, index, integer, jsonb, pgTable, primaryKey, serial, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const ROLES = ["admin", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(), // həmişə kiçik hərflə saxlanılır
    name: text("name").notNull(),
    role: text("role").$type<Role>().notNull().default("viewer"),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [check("users_role_check", sql`${t.role} in ('admin', 'viewer')`)],
);

// Cookie-də təsadüfi token saxlanılır, DB-də isə onun sha256-sı (id) — DB sızsa belə session oğurlanmır.
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// Səhv cəhdlərə limit üçün (email və IP üzrə sürüşən pəncərə).
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    ip: text("ip"),
    success: boolean("success").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("login_attempts_email_idx").on(t.email, t.createdAt),
    index("login_attempts_ip_idx").on(t.ip, t.createdAt),
  ],
);

/* ===== Data körpüsü (Google Sheet → DB) ===== */

export const SYNC_STATUS = ["running", "ok", "unchanged", "error", "skipped"] as const;
export type SyncStatus = (typeof SYNC_STATUS)[number];

// Hər sync-in loqu (handoff §7.2): nə vaxt, kim/nə başlatdı, neçə sətir, xəbərdarlıqlar, xəta
export const syncRuns = pgTable(
  "sync_runs",
  {
    id: serial("id").primaryKey(),
    trigger: text("trigger").notNull(),                 // auto (15 dəq taymer) | sheet (Sheet menyusu) | manual (paneldə Yenilə) | cli
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").$type<SyncStatus>().notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    crmRecords: integer("crm_records"),
    crmSkipped: integer("crm_skipped"),
    crmRows: integer("crm_rows"),                        // cəmlənmiş sətirlər
    marketRecords: integer("market_records"),
    stockRows: integer("stock_rows"),
    dataStart: date("data_start"),
    dataEnd: date("data_end"),
    dataHash: text("data_hash"),
    sourceHash: text("source_hash"),                     // Apps Script-in göndərdiyi xam Sheet datasının hash-i
    warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
    error: text("error"),
  },
  (t) => [index("sync_runs_started_idx").on(t.startedAt)],
);

// CRM: gün × Brend × Model × Növ × Kanal × Satış kanalı × Haradan Gəlib → say (hər dəyişiklikdə tam yenilənir)
export const crmFacts = pgTable("crm_facts", {
  day: date("day").notNull(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  nov: text("nov").notNull(),
  kanal: text("kanal").notNull(),
  satis: text("satis").notNull(),
  haradan: text("haradan").notNull(),
  cnt: integer("cnt").notNull(),
}, (t) => [index("crm_facts_day_idx").on(t.day)]);

// Bazar (Növ = Market Sales Split): ay × Brend × Model → satılmış avtomobil sayı
export const marketFacts = pgTable("market_facts", {
  ym: text("ym").notNull(),                              // YYYY-MM
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  cnt: integer("cnt").notNull(),
});

// Real Stock snapshot-ları — yalnız məzmun dəyişəndə yeni snapshot yaranır (tarixçə saxlanılır)
export const stockSnapshots = pgTable("stock_snapshots", {
  id: serial("id").primaryKey(),
  syncRunId: integer("sync_run_id").references(() => syncRuns.id, { onDelete: "set null" }),
  takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
  hash: text("hash").notNull(),
  rowCount: integer("row_count").notNull(),
});

export const stockRows = pgTable(
  "stock_rows",
  {
    snapshotId: integer("snapshot_id").notNull().references(() => stockSnapshots.id, { onDelete: "cascade" }),
    pos: smallint("pos").notNull(),                      // Sheet-dəki sıra
    brand: text("brand").notNull(),
    model: text("model").notNull(),
    version: text("version").notNull(),
    year: smallint("year"),
    price: doublePrecision("price"),
    faiz: doublePrecision("faiz"),
    ilkin: doublePrecision("ilkin"),
    muddet: text("muddet").notNull(),
    ayliq: doublePrecision("ayliq"),
    stok: integer("stok").notNull(),
    real: integer("real").notNull(),
    hedef: integer("hedef").notNull(),
    actual: integer("actual").notNull(),
    beh: integer("beh").notNull(),
    qeyd: text("qeyd").notNull(),
  },
  (t) => [index("stock_rows_snapshot_idx").on(t.snapshotId, t.pos)],
);

// Panelə verilən hazır kompakt data paketi (hər dəyişiklikdə bir dəfə qurulur, API birbaşa bunu qaytarır)
export const datasets = pgTable("datasets", {
  id: serial("id").primaryKey(),
  syncRunId: integer("sync_run_id").references(() => syncRuns.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  hash: text("hash").notNull(),
  payload: text("payload").notNull(),                   // JSON
});

// Apps Script böyük datanı hissələrlə göndərir (Vercel sorğu limiti 4.5 MB) — hissələr hamısı gələnə qədər burada saxlanılır
export const ingestParts = pgTable(
  "ingest_parts",
  {
    uploadId: text("upload_id").notNull(),
    part: integer("part").notNull(),
    total: integer("total").notNull(),
    data: text("data").notNull(),                       // gzip + base64
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.uploadId, t.part] })],
);

// Eyni anda iki sync işləməsin deyə sadə kilid (Neon pooler-də advisory lock etibarlı deyil)
export const locks = pgTable("locks", {
  name: text("name").primaryKey(),
  until: timestamp("until", { withTimezone: true }).notNull(),
});
