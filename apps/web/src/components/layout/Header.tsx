"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { useWalletStore } from "@/store/wallet.store";
import { formatXAF } from "@serenitybet/shared";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { label: "🔴 Live",   href: "/live",       highlight: true },
  { label: "Sports",    href: "/" },
  { label: "Virtuels",  href: "/virtuals" },
  { label: "Résultats", href: "/results" },
  { label: "Promotions",href: "/promotions" },
];

const MOBILE_SPORTS = [
  { icon: "⚽", label: "Football",  href: "/?sport=football" },
  { icon: "🏀", label: "Basket",    href: "/?sport=basketball" },
  { icon: "🎾", label: "Tennis",    href: "/?sport=tennis" },
  { icon: "🏈", label: "US",        href: "/?sport=american-football" },
  { icon: "⚾", label: "Baseball",  href: "/?sport=baseball" },
  { icon: "🏒", label: "Hockey",    href: "/?sport=hockey" },
  { icon: "🥊", label: "Boxe",      href: "/?sport=mma" },
  { icon: "🏐", label: "Volley",    href: "/?sport=volleyball" },
  { icon: "🏉", label: "Rugby",     href: "/?sport=rugby" },
  { icon: "🎱", label: "Snooker",   href: "/?sport=snooker" },
];

export function Header() {
  const { user, logout } = useAuthStore();
  const { balance, fetchBalance } = useWalletStore();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (user) fetchBalance();
  }, [user]);

  return (
    <header className="sticky top-0 z-40 bg-bg-secondary border-b border-bg-border">

      {/* ─── Desktop ───────────────────────────────────────────────────── */}
      <div className="hidden md:flex items-center h-14 px-4 gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0 mr-2">
          <div className="w-8 h-8 bg-green-gradient rounded-lg flex items-center justify-center font-black text-white text-sm shadow-lg shadow-green-900/40">S</div>
          <span className="font-black text-lg tracking-tight">
            <span className="text-green-400">Serenity</span><span className="text-txt-primary">bet</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 flex-1">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              link.highlight ? "text-live bg-live/10 hover:bg-live/20" : "text-txt-secondary hover:text-txt-primary hover:bg-bg-hover"
            }`}>{link.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {user ? (
            <>
              <Link href="/account/wallet" className="flex items-center gap-2 bg-bg-card border border-bg-border hover:border-green-600/50 rounded-lg px-3 py-1.5 transition-colors">
                <span className="text-green-400 text-xs font-bold">₣</span>
                <span className="text-sm font-semibold text-green-400">{formatXAF(balance)}</span>
              </Link>
              <Link href="/account/wallet" className="btn-green text-sm px-3 py-1.5">+ Dépôt</Link>
              <div className="relative group">
                <button className="flex items-center gap-2 bg-bg-card border border-bg-border rounded-lg px-3 py-1.5 text-sm hover:border-green-600/50 transition-colors">
                  <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xs">{user.firstName[0].toUpperCase()}</div>
                  <span className="text-txt-primary font-medium">{user.firstName}</span>
                  <span className="text-txt-muted text-xs">▾</span>
                </button>
                <div className="absolute right-0 top-full mt-1 w-48 bg-bg-card border border-bg-border rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="p-1">
                    <Link href="/account"        className="sidebar-item rounded-lg px-3 py-2 block text-sm">👤 Mon compte</Link>
                    <Link href="/account/bets"   className="sidebar-item rounded-lg px-3 py-2 block text-sm">🎯 Mes paris</Link>
                    <Link href="/account/wallet" className="sidebar-item rounded-lg px-3 py-2 block text-sm">💰 Portefeuille</Link>
                    <div className="divider my-1" />
                    <button onClick={logout} className="sidebar-item w-full text-left rounded-lg px-3 py-2 text-sm text-live hover:bg-live/10">Déconnexion</button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link href="/login"    className="btn-outline text-sm px-4 py-1.5">Connexion</Link>
              <Link href="/register" className="btn-green text-sm px-4 py-1.5">S'inscrire</Link>
            </>
          )}
        </div>
      </div>

      {/* ─── Mobile ────────────────────────────────────────────────────── */}
      <div className="md:hidden">
        {/* Ligne principale */}
        <div className="flex items-center h-12 px-3 gap-2">
          <Link href="/" className="flex items-center gap-1.5 shrink-0">
            <div className="w-7 h-7 bg-green-gradient rounded-md flex items-center justify-center font-black text-white text-xs">S</div>
            <span className="font-black text-base"><span className="text-green-400">Serenity</span><span className="text-txt-primary">bet</span></span>
          </Link>
          <div className="flex-1" />
          {user ? (
            <div className="flex items-center gap-1.5">
              <Link href="/account/wallet" className="flex items-center gap-1 bg-bg-card border border-bg-border rounded-lg px-2.5 py-1.5 active:scale-95 transition-transform">
                <span className="text-[10px] font-bold text-green-400">₣</span>
                <span className="text-sm font-black text-green-400">{formatXAF(balance)}</span>
              </Link>
              <Link href="/account/wallet?tab=deposit" className="bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg active:bg-green-700">
                + Dépôt
              </Link>
              <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 flex flex-col items-center justify-center gap-1 bg-bg-card border border-bg-border rounded-lg">
                <span className="w-3.5 h-0.5 bg-txt-secondary rounded" />
                <span className="w-3.5 h-0.5 bg-txt-secondary rounded" />
                <span className="w-2.5 h-0.5 bg-txt-secondary rounded" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login"    className="text-sm font-semibold text-txt-secondary px-3 py-1.5 border border-bg-border rounded-lg active:scale-95">Connexion</Link>
              <Link href="/register" className="text-sm font-bold bg-green-600 text-white px-3 py-1.5 rounded-lg active:bg-green-700">Inscription</Link>
            </div>
          )}
        </div>

        {/* Menu déroulant */}
        {menuOpen && (
          <div className="absolute left-0 right-0 bg-bg-card border-b border-bg-border shadow-2xl z-50">
            <div className="p-3 space-y-0.5">
              {[
                { icon: "👤", label: "Mon compte",       href: "/account" },
                { icon: "🎯", label: "Mes paris",         href: "/account/bets" },
                { icon: "💰", label: "Portefeuille",      href: "/account/wallet" },
                { icon: "🎁", label: "Promotions",        href: "/promotions" },
                { icon: "🔞", label: "Jeu responsable",   href: "/responsible-gaming" },
              ].map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-bg-hover active:bg-bg-hover text-sm font-medium text-txt-primary">
                  <span>{item.icon}</span>{item.label}
                </Link>
              ))}
              <div className="border-t border-bg-border mt-1 pt-1">
                <button onClick={() => { logout(); setMenuOpen(false); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-live text-sm font-medium w-full">
                  🚪 Déconnexion
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Barre sports horizontale */}
        <div className="flex items-center border-t border-bg-border overflow-x-auto scrollbar-none py-1">
          <Link href="/live" className="flex-none flex flex-col items-center px-3 py-1 text-live">
            <span className="text-base relative">🔴<span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 bg-live rounded-full animate-pulse" /></span>
            <span className="text-[9px] font-bold mt-0.5">Live</span>
          </Link>
          {MOBILE_SPORTS.map((s) => (
            <Link key={s.href} href={s.href}
              className="flex-none flex flex-col items-center px-3 py-1 active:opacity-60">
              <span className="text-base">{s.icon}</span>
              <span className="text-[9px] font-medium text-txt-muted mt-0.5">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
