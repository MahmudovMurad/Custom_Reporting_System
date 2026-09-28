import { requireUser } from "@/lib/dal";
import UserMenu from "@/components/user-menu";
import styles from "./page.module.css";

const SECTIONS = [
  ["SALES OVERVIEW", "CRM · müraciət, trafik və satış"],
  ["MARKET SHARE ANALYSIS", "Market Sales Split · brend və model üzrə bazar payı"],
  ["STOCK OVERVIEW", "Real Stock · stok, hədəf və satış"],
] as const;

export default async function AnalyticsPage() {
  const user = await requireUser();
  return (
    <>
      <header className={styles.strip}>
        <div className={`wrap ${styles.stripIn}`}>
          <div className={styles.logo}><i>SR</i>SR AUTO</div>
          <UserMenu user={{ name: user.name, email: user.email, role: user.role }} />
        </div>
      </header>
      <main className="wrap">
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
