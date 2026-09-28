"use client";

import { useEffect, useRef, type ReactNode } from "react";
import s from "./ui.module.css";

// Nativ <dialog> — fokus tələsi və Escape brauzerdən gəlir
export default function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className={`${s.modal}${wide ? " " + s.wide : ""}`} onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <div className={s.modalHead}>
        <h2>{title}</h2>
        <button type="button" className={s.x} aria-label="Bağla" onClick={() => ref.current?.close()}>×</button>
      </div>
      <div className={s.modalBody}>{children}</div>
    </dialog>
  );
}
