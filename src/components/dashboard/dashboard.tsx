"use client";

import { useEffect, useRef } from "react";
import { triggerSync } from "@/app/actions/sync";
import { MARKUP } from "./markup";
import "@/app/dashboard.css";
import "@/app/dashboard-mobile.css";

// Köhnə panelin mühərriki (engine.js) bu konteynerin içini imperativ idarə edir — React məzmuna toxunmur.
export default function Dashboard({ isAdmin }: { isAdmin: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let destroy: (() => void) | undefined, dead = false;
    import("./engine").then(({ mountDashboard }) => {
      if (!dead) destroy = mountDashboard({ isAdmin, triggerSync });
    });
    const el = ref.current;
    return () => {
      dead = true;
      destroy?.();
      if (el) el.innerHTML = MARKUP;       // elementlərə bağlı dinləyicilər də silinsin (dev-də ikiqat mount)
    };
  }, [isAdmin]);
  return <main className="wrap" id="app" ref={ref} dangerouslySetInnerHTML={{ __html: MARKUP }} />;
}
