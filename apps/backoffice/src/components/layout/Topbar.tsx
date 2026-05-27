"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":   "Dashboard",
  "/sports":      "Matchs & Cotes",
  "/bets":        "Gestion des paris",
  "/users":       "Parieurs",
  "/kyc":         "KYC / Vérification identité",
  "/reports":     "Finances & Analytics",
  "/withdrawals": "Demandes de retrait",
  "/settings":    "Paramètres système",
  "/logs":        "Logs système",
};

export function Topbar() {
  const pathname = usePathname();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const title = PAGE_TITLES[pathname] ?? "Backoffice";

  return (
    <header className="sticky top-0 z-30 h-[52px] bg-bo-card border-b border-bo-border flex items-center justify-between px-6 shrink-0">
      <h1 className="font-bold text-base text-t-primary">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Date/heure */}
        <span className="text-[11px] text-t-faint hidden sm:block">
          {format(now, "d MMM yyyy · HH:mm", { locale: fr })}
        </span>

        {/* Indicateur live */}
        <div className="flex items-center gap-1.5 bg-bo-surface border border-bo-border2 rounded-lg px-2.5 py-1">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] text-green-400 font-semibold">API connectée</span>
        </div>

        {/* Notifications */}
        <button className="relative w-7 h-7 flex items-center justify-center bg-bo-surface border border-bo-border2 rounded-lg text-t-muted hover:text-t-primary hover:border-green-500/50 transition-all">
          <span className="text-sm">🔔</span>
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-bo-card" />
        </button>
      </div>
    </header>
  );
}
