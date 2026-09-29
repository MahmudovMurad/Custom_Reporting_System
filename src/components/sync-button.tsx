"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { triggerSync } from "@/app/actions/sync";
import s from "./ui.module.css";

// "Yenilə" — yalnız admin görür (səhifə bunu yalnız admin üçün render edir; action da requireAdmin yoxlayır)
export default function SyncButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);

  const run = () => start(async () => {
    setMsg({ kind: "info", text: "Google Sheet oxunur… (10–40 saniyə)" });
    const r = await triggerSync();
    setMsg({ kind: r.status === "error" ? "error" : r.status === "ok" ? "ok" : "info", text: r.message });
    if (r.status === "ok") router.refresh();
  });

  return (
    <div className={s.syncWrap}>
      <button type="button" className={`btn primary ${s.syncBtn}${pending ? " " + s.spin : ""}`} onClick={run} disabled={pending}
        title="Google Sheet-dən son datanı indi oxu">
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.6 8a5.6 5.6 0 1 1-1.7-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M13.2 1.6v3h-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {pending ? "Yenilənir…" : "Yenilə"}
      </button>
      {msg && <span className={`alert ${msg.kind} ${s.syncMsg}`} role="status">{msg.text}</span>}
    </div>
  );
}
