"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { useWalletStore } from "@/store/wallet.store";
import { formatXAF } from "@serenitybet/shared";
import { useEffect } from "react";

const NAV_LINKS = [
  { label: "🔴 Live", href: "/live", highlight: true },
  { label: "Sports", href: "/" },
  { label: "Virtuels", href: "/virtuals" },
  { label: "Résultats", href: "/results" },
  { label: "Promotions", href: "/promotions" },
];

export function Header() {
  const { user, logout } = useAuthStore();
  const { balance, fetchBalance } = useWalletStore();

  useEffect(() => {
    if (user) fetchBalance();
  }, [user]);

  return (
    <header className="sticky top-0 z-50 bg-bg-secondary border-b border-bg-border">
      {/* Barre principale */}
      <div className="flex items-center h-14 px-4 gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 mr-2">
          <div className="w-8 h-8 bg-green-gradient rounded-lg flex items-center justify-center font-black text-white text-sm shadow-lg shadow-green-900/40">
            S
          </div>
          <span className="font-black text-lg tracking-tight hidden sm:block">
            <span className="text-green-400">Serenity</span>
            <span className="text-txt-primary">bet</span>
          </span>
        </Link>

        {/* Navigation centrale */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                link.highlight
                  ? "text-live bg-live/10 hover:bg-live/20"
                  : "text-txt-secondary hover:text-txt-primary hover:bg-bg-hover"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Zone utilisateur */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {user ? (
            <>
              {/* Solde */}
              <Link
                href="/account/wallet"
                className="hidden sm:flex items-center gap-2 bg-bg-card border border-bg-border hover:border-green-600/50 rounded-lg px-3 py-1.5 transition-colors"
              >
                <div className="w-5 h-5 bg-green-600/20 rounded-full flex items-center justify-center">
                  <span className="text-green-400 text-xs font-bold">₣</span>
                </div>
                <span className="text-sm font-semibold text-green-400">{formatXAF(balance)}</span>
              </Link>

              {/* Dépôt rapide */}
              <Link href="/account/wallet" className="btn-green text-sm px-3 py-1.5 hidden sm:block">
                + Dépôt
              </Link>

              {/* Menu compte */}
              <div className="relative group">
                <button className="flex items-center gap-2 bg-bg-card border border-bg-border rounded-lg px-3 py-1.5 text-sm hover:border-green-600/50 transition-colors">
                  <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                    {user.firstName[0].toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-txt-primary font-medium">{user.firstName}</span>
                  <span className="text-txt-muted text-xs">▾</span>
                </button>
                <div className="absolute right-0 top-full mt-1 w-48 bg-bg-card border border-bg-border rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="p-1">
                    <Link href="/account" className="sidebar-item rounded-lg px-3 py-2 block text-sm">👤 Mon compte</Link>
                    <Link href="/account/bets" className="sidebar-item rounded-lg px-3 py-2 block text-sm">🎯 Mes paris</Link>
                    <Link href="/account/wallet" className="sidebar-item rounded-lg px-3 py-2 block text-sm">💰 Portefeuille</Link>
                    <div className="divider my-1" />
                    <button onClick={logout} className="sidebar-item w-full text-left rounded-lg px-3 py-2 text-sm text-live hover:bg-live/10">
                      Déconnexion
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-outline text-sm px-4 py-1.5">
                Connexion
              </Link>
              <Link href="/register" className="btn-green text-sm px-4 py-1.5">
                S'inscrire
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Sous-barre sports mobile */}
      <div className="md:hidden flex items-center gap-1 px-3 py-1.5 border-t border-bg-border overflow-x-auto scrollbar-none">
        {["⚽", "🏀", "🎾", "🏈", "⚾", "🏒", "🎱"].map((icon, i) => (
          <button key={i} className="sport-tab flex-row gap-1.5 py-1.5">
            <span>{icon}</span>
          </button>
        ))}
      </div>
    </header>
  );
}
