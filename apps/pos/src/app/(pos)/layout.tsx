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
      api.get("/cashier/wallet").then(r => setFloatXAF(r.data.data.balanceXAF)).catch(() => {});
    }
  }, [token, router]);

  if (!token) return null;

  function handleLogout() {
    logout();
    setAuthToken(null);
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Topbar */}
      <header className="bg-green-700 text-white px-6 py-4 flex items-center justify-between shadow-md no-print">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💰</span>
          <div>
            <span className="font-bold text-lg">Serenitybet Caisse</span>
            <span className="ml-3 text-green-200 text-sm hidden sm:inline">
              Agent: {cashier?.firstName} {cashier?.lastName}
            </span>
            {floatXAF !== null && (
              <span className={`ml-4 px-3 py-1 rounded-lg text-sm font-bold ${floatXAF < 0 ? "bg-red-600 text-white" : "bg-green-900 text-green-200"}`}>
                Float: {Math.abs(floatXAF).toLocaleString("fr-FR")} XAF{floatXAF < 0 ? " ⚠️" : ""}
              </span>
            )}
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              pathname === "/" ? "bg-white text-green-700" : "hover:bg-green-600 text-white"
            }`}
          >
            🏠 Caisse
          </Link>
          <Link
            href="/withdrawals"
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              pathname === "/withdrawals" ? "bg-white text-green-700" : "hover:bg-green-600 text-white"
            }`}
          >
            💸 Retraits
          </Link>
          <Link
            href="/history"
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              pathname === "/history" ? "bg-white text-green-700" : "hover:bg-green-600 text-white"
            }`}
          >
            📋 Historique
          </Link>
          <button
            onClick={handleLogout}
            className="ml-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-semibold text-sm transition-colors"
          >
            Déconnexion
          </button>
        </nav>
      </header>

      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
