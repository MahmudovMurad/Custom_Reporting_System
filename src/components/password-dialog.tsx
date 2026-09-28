"use client";

import { useActionState } from "react";
import { changeOwnPassword } from "@/app/actions/auth";
import { PASSWORD_MIN } from "@/lib/password-rules";
import Modal from "./modal";
import s from "./ui.module.css";

export default function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(changeOwnPassword, undefined);
  return (
    <Modal title="Şifrəni dəyiş" onClose={onClose}>
      {state?.ok ? (
        <div className={s.stack}>
          <div className="alert ok">Şifrə dəyişdirildi.</div>
          <div className={s.actions}><button type="button" className="btn primary" onClick={onClose}>Bağla</button></div>
        </div>
      ) : (
        <form action={action} className={s.stack}>
          <label className="field">Hazırkı şifrə<input name="current" type="password" autoComplete="current-password" required autoFocus /></label>
          <label className="field">Yeni şifrə<input name="next" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} required /></label>
          <label className="field">Yeni şifrə (təkrar)<input name="confirm" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} required /></label>
          {state?.error && <div className="alert error" role="alert">{state.error}</div>}
          <div className={s.actions}>
            <button type="button" className="btn" onClick={onClose}>Ləğv et</button>
            <button type="submit" className="btn primary" disabled={pending}>{pending ? "Saxlanılır…" : "Saxla"}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
