"use client";

import { Fragment, useEffect, useState } from "react";
import { listSyncRuns, type SyncRunRow } from "@/app/actions/sync";
import { MON3 } from "@/lib/format";
import Modal from "./modal";
import s from "./ui.module.css";

const STATUS: Record<string, string> = { ok: "Yeniləndi", unchanged: "Dəyişiklik yox", error: "Xəta", running: "Gedir…", skipped: "Ötürüldü" };
const TRIGGER: Record<string, string> = { cron: "Avto", manual: "Əl ilə", cli: "Terminal" };
const when = (iso: string) => { const d = new Date(iso), p = (n: number) => String(n).padStart(2, "0"); return `${d.getDate()} ${MON3[d.getMonth()]} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const n = (v: number | null) => (v == null ? "—" : v.toLocaleString("en-US"));

export default function SyncLogDialog({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<SyncRunRow[] | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { listSyncRuns().then(setRows).catch((e) => setErr(String(e.message || e))); }, []);

  return (
    <Modal title="Sync loqu" onClose={onClose} wide>
      {err && <div className="alert error">{err}</div>}
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead><tr><th>VAXT</th><th>MƏNBƏ</th><th>NƏTİCƏ</th><th>CRM</th><th>BAZAR</th><th>STOK</th><th>DATA SONU</th><th>MÜDDƏT</th></tr></thead>
          <tbody>
            {!rows && !err && <tr><td colSpan={8} className={s.empty}>Yüklənir…</td></tr>}
            {rows?.length === 0 && <tr><td colSpan={8} className={s.empty}>Hələ sync olmayıb.</td></tr>}
            {rows?.map((r) => {
              const extra = r.error || r.warnings.length;
              return (
                <Fragment key={r.id}>
                  <tr className={extra ? s.clickable : undefined} onClick={() => extra && setOpen(open === r.id ? null : r.id)}>
                    <td className={s.nowrap}>{when(r.startedAt)}</td>
                    <td>{TRIGGER[r.trigger] || r.trigger}</td>
                    <td className={s.nowrap}>
                      <span className={`${s.badge} ${s["st_" + r.status] || ""}`}>{STATUS[r.status] || r.status}</span>
                      {r.warnings.length > 0 && <span className={s.warnCount} title="Xəbərdarlıqlar"> ⚠ {r.warnings.length}</span>}
                    </td>
                    <td>{n(r.crmRecords)}</td><td>{n(r.marketRecords)}</td><td>{n(r.stockRows)}</td>
                    <td className={s.nowrap}>{r.dataEnd ?? "—"}</td>
                    <td>{r.durationMs == null ? "—" : (r.durationMs / 1000).toFixed(1) + " s"}</td>
                  </tr>
                  {open === r.id && (
                    <tr><td colSpan={8} className={s.detail}>
                      {r.error && <div className="alert error">{r.error}</div>}
                      {r.warnings.length > 0 && <ul>{r.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
