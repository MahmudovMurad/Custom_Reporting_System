"use client";

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { createUser, deleteUser, listUsers, resetPassword, setRole, type Result, type UserRow } from "@/app/actions/users";
import type { Role } from "@/db/schema";
import { dateTimeShort } from "@/lib/format";
import { PASSWORD_MIN } from "@/lib/password-rules";
import Modal from "./modal";
import s from "./ui.module.css";

const ROLE_TXT: Record<Role, string> = { admin: "Admin", viewer: "İzləyici" };
const when = (iso: string | null) => (iso ? dateTimeShort(new Date(iso)) : "—");

type Notice = { kind: "ok" | "error"; text: string; password?: string };

export default function UsersDialog({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reload = useCallback(() => listUsers().then(setUsers).catch((e) => setNotice({ kind: "error", text: String(e.message || e) })), []);
  useEffect(() => { reload(); }, [reload]);

  const run = (fn: () => Promise<Result>, okText: string) => start(async () => {
    const r = await fn();
    setConfirmDel(null);
    if (!r.ok) { setNotice({ kind: "error", text: r.error }); return; }
    setNotice({ kind: "ok", text: okText, password: r.password });
    await reload();
  });

  const onCreate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const input = { name: String(f.get("name")), email: String(f.get("email")), role: String(f.get("role")) as Role,
      password: String(f.get("password") || "") || undefined };
    start(async () => {
      const r = await createUser(input);
      if (!r.ok) { setNotice({ kind: "error", text: r.error }); return; }
      form.reset();
      setNotice({ kind: "ok", text: `${input.email.trim().toLowerCase()} yaradıldı.`, password: r.password });
      await reload();
    });
  };

  return (
    <Modal title="İstifadəçilər" onClose={onClose} wide>
      <div className={s.stack}>
        {notice && (
          <div className={`alert ${notice.kind}`} role="status">
            {notice.text}
            {notice.password && (
              <div className={s.pw}>
                Müvəqqəti şifrə: <code>{notice.password}</code>
                <button type="button" className="link" onClick={() => navigator.clipboard?.writeText(notice.password!)}>Kopyala</button>
                <small>Bu şifrə yalnız indi göstərilir — istifadəçiyə ötürün.</small>
              </div>
            )}
          </div>
        )}

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>AD</th><th>EMAIL</th><th>ROL</th><th>SON GİRİŞ</th><th></th></tr></thead>
            <tbody>
              {!users && <tr><td colSpan={5} className={s.empty}>Yüklənir…</td></tr>}
              {users?.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select aria-label={`${u.name} — rol`} value={u.role} disabled={pending}
                      onChange={(e) => run(() => setRole(u.id, e.target.value as Role), `${u.email}: rol dəyişdi.`)}>
                      <option value="viewer">{ROLE_TXT.viewer}</option>
                      <option value="admin">{ROLE_TXT.admin}</option>
                    </select>
                  </td>
                  <td className={s.nowrap}>{when(u.lastLoginAt)}</td>
                  <td className={s.rowActions}>
                    {confirmDel === u.id ? (
                      <>
                        <span>Silinsin?</span>
                        <button type="button" className="link" disabled={pending} onClick={() => run(() => deleteUser(u.id), `${u.email} silindi.`)}>Bəli, sil</button>
                        <button type="button" className="link" onClick={() => setConfirmDel(null)}>Xeyr</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="link" disabled={pending} onClick={() => run(() => resetPassword(u.id), `${u.email}: şifrə sıfırlandı, açıq girişlər bağlandı.`)}>Şifrəni sıfırla</button>
                        <button type="button" className={`link ${s.danger}`} disabled={pending} onClick={() => setConfirmDel(u.id)}>Sil</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={onCreate} className={s.addForm}>
          <h3>Yeni istifadəçi</h3>
          <div className={s.addGrid}>
            <label className="field">Ad<input name="name" required /></label>
            <label className="field">Email<input name="email" type="email" required /></label>
            <label className="field">Rol
              <select name="role" defaultValue="viewer">
                <option value="viewer">{ROLE_TXT.viewer}</option>
                <option value="admin">{ROLE_TXT.admin}</option>
              </select>
            </label>
            <label className="field">Şifrə<input name="password" type="text" minLength={PASSWORD_MIN} placeholder="boş qalsa yaradılacaq" autoComplete="off" /></label>
          </div>
          <div className={s.actions}><button type="submit" className="btn primary" disabled={pending}>Əlavə et</button></div>
        </form>
      </div>
    </Modal>
  );
}
