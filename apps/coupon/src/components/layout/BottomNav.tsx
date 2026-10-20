"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();

  const TABS = [
    { icon: "📰", label: "Journal",  href: "/",         active: pathname === "/" },
    { icon: "🔎", label: "Vérifier", href: "/verifier", active: pathname === "/verifier" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950 border-t border-slate-800 md:hidden">
      <div className="flex items-center">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
              tab.active ? "text-green-400" : "text-slate-400"
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-[9px] font-semibold uppercase tracking-wide">{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
