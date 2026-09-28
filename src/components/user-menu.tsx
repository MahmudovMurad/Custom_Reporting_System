"use client";

import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions/auth";
import type { Role } from "@/db/schema";
import PasswordDialog from "./password-dialog";
import UsersDialog from "./users-dialog";
import s from "./ui.module.css";

type Props = { user: { name: string; email: string; role: Role } };

export default function UserMenu({ user }: Props) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"users" | "password" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const pick = (d: "users" | "password") => { setOpen(false); setDialog(d); };

  return (
    <div className={s.menuWrap} ref={ref}>
      <button type="button" className={s.menuBtn} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={s.avatar} aria-hidden="true">{user.name.trim().charAt(0).toUpperCase() || "?"}</span>
        <span className={s.menuName}>{user.name}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className={s.menu} role="menu">
          <div className={s.menuHead}>
            <b>{user.name}</b>
            <span>{user.email}</span>
            <span className={s.roleTag}>{user.role === "admin" ? "Admin" : "İzləyici"}</span>
          </div>
          {user.role === "admin" && (
            <button type="button" role="menuitem" className={s.menuItem} onClick={() => pick("users")}>İstifadəçilər</button>
          )}
          <button type="button" role="menuitem" className={s.menuItem} onClick={() => pick("password")}>Şifrəni dəyiş</button>
          <form action={logout}>
            <button type="submit" role="menuitem" className={s.menuItem}>Çıxış</button>
          </form>
        </div>
      )}
      {dialog === "users" && <UsersDialog onClose={() => setDialog(null)} />}
      {dialog === "password" && <PasswordDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
