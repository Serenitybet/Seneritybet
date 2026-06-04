"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useBetSlipStore } from "@/store/betslip.store";

export function BottomNav() {
  const pathname  = usePathname();
  const { user }  = useAuthStore();
  const { selections } = useBetSlipStore();

  const TABS = [
    { icon: "🏠", label: "Accueil",  href: "/",            active: pathname === "/" },
    { icon: "🔴", label: "Live",     href: "/live",         active: pathname === "/live", live: true },
    { icon: "🎯", label: "Paris",    href: user ? "/account/bets" : "/login", active: pathname === "/account/bets" },
    { icon: "👤", label: "Compte",   href: user ? "/account" : "/login",      active: pathname === "/account" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-bg-secondary border-t border-bg-border md:hidden safe-bottom">
      <div className="flex items-center">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors relative ${
              tab.active ? "text-green-400" : "text-txt-muted"
            }`}
          >
            <span className={`text-xl ${tab.live ? "relative" : ""}`}>
              {tab.live && (
                <span className="absolute -top-0.5 -right-1.5 w-1.5 h-1.5 bg-live rounded-full animate-pulse" />
              )}
              {tab.icon}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wide">{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
