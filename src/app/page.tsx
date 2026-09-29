import { desc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/dal";
import { bakuDateTime, isoLong } from "@/lib/format";
import SyncButton from "@/components/sync-button";
import UserMenu from "@/components/user-menu";
import styles from "./page.module.css";

// "Yenilə" server action-u bu səhifənin funksiyasında işləyir — Sheet oxunuşu üçün vaxt lazımdır
export const maxDuration = 300;

const SECTIONS = [
  ["SALES OVERVIEW", "CRM · müraciət, trafik və satış"],
  ["MARKET SHARE ANALYSIS", "Market Sales Split · brend və model üzrə bazar payı"],
  ["STOCK OVERVIEW", "Real Stock · stok, hədəf və satış"],
] as const;

export default async function AnalyticsPage() {
  const user = await requireUser();
  const db = await getDb();
  const [last] = await db.select().from(schema.syncRuns)
    .where(inArray(schema.syncRuns.status, ["ok", "unchanged"])).orderBy(desc(schema.syncRuns.id)).limit(1);
  return (
    <>
      <header className={styles.strip}>
        <div className={`wrap ${styles.stripIn}`}>
          <div className={styles.logo}><i>SR</i>SR AUTO</div>
          <UserMenu user={{ name: user.name, email: user.email, role: user.role }} />
        </div>
      </header>
      <main className="wrap">
        <div className={styles.bar}>
          {last ? (
            <>
              <span className={styles.stamp}>Son yoxlama: <b>{bakuDateTime(last.finishedAt ?? last.startedAt)}</b></span>
              {last.dataStart && last.dataEnd && (
                <span className={styles.stamp}>Data: <b>{isoLong(last.dataStart)} – {isoLong(last.dataEnd)}</b> · {(last.crmRecords ?? 0).toLocaleString("en-US")} sətir</span>
              )}
            </>
          ) : (
            <span className={styles.stamp}>Hələ sync olmayıb — data Google Sheet-dən ilk dəfə oxunmayıb.</span>
          )}
          {user.role === "admin" && <SyncButton />}
        </div>
        {SECTIONS.map(([title, sub]) => (
          <section key={title} className={styles.sec}>
            <div className={styles.secHead}>
              <h2>{title}</h2>
              <p>{sub}</p>
            </div>
            <div className={styles.placeholder}>Bu bölmə 3-cü mərhələdə köhnə paneldən köçürüləcək.</div>
          </section>
        ))}
      </main>
    </>
  );
}
