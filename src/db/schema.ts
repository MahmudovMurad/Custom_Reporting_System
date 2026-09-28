import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
