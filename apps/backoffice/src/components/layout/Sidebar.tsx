"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthAdminStore } from "@/store/auth-admin.store";

const NAV = [
  {
    section: "Principal",
    items: [
      { href: "/dashboard", label: "Dashboard",       icon: "▣", badge: null },
      { href: "/sports",    label: "Matchs & Cotes",  icon: "⚽", badge: null },
      { href: "/bets",      label: "Paris",            icon: "🎯", badge: "12" },
    ],
  },
  {
    section: "Utilisateurs",
    items: [
      { href: "/users",     label: "Parieurs",         icon: "👥", badge: null },
      { href: "/kyc",       label: "KYC / Vérification", icon: "🪪", badge: "5" },
    ],
  },
  {
    section: "Finances",
    items: [
      { href: "/reports",     label: "Finances",       icon: "📊", badge: null },
      { href: "/withdrawals", label: "Retraits",       icon: "↑↓", badge: "3" },
    ],
  },
  {
    section: "Système",
    items: [
      { href: "/shops",    label: "Boutiques",          icon: "🏪", badge: null },
      { href: "/settings", label: "Paramètres",         icon: "⚙",  badge: null },
      { href: "/logs",     label: "Logs système",        icon: "▶",  badge: null },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { admin, logout } = useAuthAdminStore();

  function isActive(href: string) {
    return pathname === href || (pathname.startsWith(href) && href !== "/dashboard");
  }

  return (
    <aside className="fixed left-0 top-0 w-56 h-screen bg-bo-card border-r border-bo-border flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-bo-border shrink-0">
        <div className="w-8 h-8 bg-green-grd rounded-lg flex items-center justify-center font-black text-white text-sm shadow-lg shadow-green-900/40">
          S
        </div>
        <div>
          <p className="font-black text-sm text-t-primary leading-tight">
            <span className="text-green-400">Serenity</span>bet
          </p>
          <p className="text-[10px] text-t-faint uppercase tracking-wider">Backoffice</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map((group) => (
          <div key={group.section} className="mb-1">
            <p className="nav-section">{group.section}</p>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive(item.href) ? "active" : ""}`}
              >
                <span className="w-4 text-center text-[13px]">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Admin profile */}
      <div className="p-3 border-t border-bo-border shrink-0">
        <div className="flex items-center gap-2.5 p-2.5 bg-bo-surface rounded-lg border border-bo-border">
          <div className="w-7 h-7 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold text-xs shrink-0">
            {admin?.firstName?.[0]?.toUpperCase() ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-t-primary truncate">
              {admin ? `${admin.firstName} ${admin.lastName}` : "Admin"}
            </p>
            <p className="text-[10px] text-green-400 uppercase tracking-wide">
              {admin?.role ?? "Administrateur"}
            </p>
          </div>
          <button
            onClick={logout}
            className="text-t-faint hover:text-red-400 transition-colors text-xs"
            title="Déconnexion"
          >
            ✕
          </button>
        </div>
      </div>
    </aside>
  );
}
