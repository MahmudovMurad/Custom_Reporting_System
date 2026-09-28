// drizzle/ qovluğundakı miqrasiyaları DATABASE_URL-dəki DB-yə tətbiq edir (Vercel build-də də işləyir).
import "dotenv/config";
import { connect } from "../src/db/connect";

const { db, close, kind } = await connect();   // PGlite rejimində connect() özü miqrasiya edir
try {
  if (kind === "postgres") {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db as never, { migrationsFolder: "drizzle" });
  }
  console.log(`Miqrasiyalar tətbiq olundu (${kind}).`);
} finally {
  await close();
}
