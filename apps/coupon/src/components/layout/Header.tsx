"use client";

import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { label: "Journal des événements", href: "/" },
  { label: "Vérifier un code",       href: "/verifier" },
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
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-bg-secondary border-b border-bg-border">

      {/* ─── Desktop ───────────────────────────────────────────────────── */}
      <div className="hidden md:flex items-center h-14 px-4 gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0 mr-2">
          <div className="w-8 h-8 bg-green-gradient rounded-lg flex items-center justify-center font-black text-white text-sm shadow-lg shadow-green-900/40">S</div>
          <span className="font-black text-lg tracking-tight">
            <span className="text-green-400">Serenity</span><span className="text-txt-primary">bet</span>
          </span>
          <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-gold border border-gold/40 bg-gold/10 px-1.5 py-0.5 rounded">
            Coupons
          </span>
        </Link>
        <nav className="flex items-center gap-1 flex-1">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-txt-secondary hover:text-txt-primary hover:bg-bg-hover transition-colors">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 ml-auto shrink-0 text-xs text-txt-muted">
          Sans compte · Mise en espèces en boutique
        </div>
      </div>

      {/* ─── Mobile ────────────────────────────────────────────────────── */}
      <div className="md:hidden">
        <div className="flex items-center h-12 px-3 gap-2">
          <Link href="/" className="flex items-center gap-1.5 shrink-0">
            <div className="w-7 h-7 bg-green-gradient rounded-md flex items-center justify-center font-black text-white text-xs">S</div>
            <span className="font-black text-base"><span className="text-green-400">Serenity</span><span className="text-txt-primary">bet</span></span>
          </Link>
          <div className="flex-1" />
          <Link href="/verifier" className="text-xs font-semibold text-txt-secondary px-2.5 py-1.5 border border-bg-border rounded-lg active:scale-95">
            Vérifier un code
          </Link>
          <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 flex flex-col items-center justify-center gap-1 bg-bg-card border border-bg-border rounded-lg">
            <span className="w-3.5 h-0.5 bg-txt-secondary rounded" />
            <span className="w-3.5 h-0.5 bg-txt-secondary rounded" />
            <span className="w-2.5 h-0.5 bg-txt-secondary rounded" />
          </button>
        </div>

        {menuOpen && (
          <div className="absolute left-0 right-0 bg-bg-card border-b border-bg-border shadow-2xl z-50">
            <div className="p-3 space-y-0.5">
              <Link href="/" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-bg-hover text-sm font-medium text-txt-primary">
                📰 Journal des événements
              </Link>
              <Link href="/verifier" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-bg-hover text-sm font-medium text-txt-primary">
                🔎 Vérifier un code
              </Link>
            </div>
          </div>
        )}

        {/* Barre sports horizontale */}
        <div className="flex items-center border-t border-bg-border overflow-x-auto scrollbar-none py-1">
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
