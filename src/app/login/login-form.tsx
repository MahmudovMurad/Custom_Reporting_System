"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import styles from "./login.module.css";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="next" value={next} />
      <label className="field">
        Email
        <input name="email" type="email" autoComplete="username" required autoFocus defaultValue={state?.email} />
      </label>
      <label className="field">
        Şifrə
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error && <div className="alert error" role="alert">{state.error}</div>}
      <button type="submit" className={`btn primary ${styles.submit}`} disabled={pending}>
        {pending ? "Yoxlanılır…" : "Daxil ol"}
      </button>
    </form>
  );
}
