"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { api, setAuthToken } from "@/lib/api";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, cashier, logout } = useAuthStore();
  const [floatXAF, setFloatXAF] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
    } else {
      setAuthToken(token);
      api.get("/cashier-wallet/my").then(r => setFloatXAF(r.data.data.balanceXAF)).catch(() => {});
    }
  }, [token, router]);

  if (!token) return null;

  function handleLogout() {
    logout();
    setAuthToken(null);
    router.replace("/login");
  }

  const isHome = pathname === "/";

  const NAV_ITEMS = [
    { href: "/",            icon: "🏠", label: "Accueil" },
    { href: "/caisse",      icon: "💰", label: "Caisse" },
    { href: "/tickets",     icon: "🎫", label: "Tickets" },
    { href: "/tpe-ticket",  icon: "🆕", label: "Nouveau" },
    { href: "/tpe-payout",  icon: "📷", label: "Scanner" },
    { href: "/tpe-history", icon: "🧾", label: "Historique" },
    { href: "/withdrawals", icon: "💸", label: "Retraits" },
    { href: "/history",     icon: "📋", label: "Caisse du jour" },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Topbar */}
      <header className="bg-slate-950 text-white no-print">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl shrink-0">💰</span>
            <span className="font-black text-lg text-green-400 tracking-tight truncate">Serenitybet</span>
            <span className="text-slate-400 text-xs hidden sm:inline truncate">
              {cashier?.firstName} {cashier?.lastName}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {floatXAF !== null && (
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold hidden sm:inline ${floatXAF < 0 ? "bg-red-600 text-white" : "bg-green-500/10 text-green-400"}`}>
                Float: {Math.abs(floatXAF).toLocaleString("fr-FR")} XAF{floatXAF < 0 ? " ⚠️" : ""}
              </span>
            )}
            {!isHome && (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-red-500/90 hover:bg-red-500 rounded-lg font-semibold text-xs transition-colors"
              >
                Déconnexion
              </button>
            )}
          </div>
        </div>
        {!isHome && (
          <nav className="flex items-center gap-1 overflow-x-auto px-2 py-1.5 border-b border-green-500/30">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg font-semibold text-[10px] leading-none transition-colors shrink-0 ${
                  pathname === item.href ? "bg-green-500 text-slate-950" : "hover:bg-slate-800 text-slate-300"
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className={isHome ? "flex-1" : "flex-1 p-4 sm:p-6"}>{children}</main>
    </div>
  );
}
