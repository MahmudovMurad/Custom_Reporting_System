import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import LoginForm from "./login-form";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Giriş — SR Reporting" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.head}>
          <div className={styles.logo}><i>SR</i>SR AUTO</div>
          <p>Reporting System</p>
        </div>
        <LoginForm next={typeof next === "string" ? next : ""} />
      </div>
      <p className={styles.foot}>Hesab yalnız admin tərəfindən yaradılır. Giriş problemi olarsa adminə müraciət edin.</p>
    </main>
  );
}
