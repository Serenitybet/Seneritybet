"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const SPORTS = [
  { icon: "⚽", label: "Football",    slug: "football",    count: 142 },
  { icon: "🏀", label: "Basketball",  slug: "basketball",  count: 38 },
  { icon: "🎾", label: "Tennis",      slug: "tennis",      count: 24 },
  { icon: "🏈", label: "Américain",   slug: "american-football", count: 12 },
  { icon: "⚾", label: "Baseball",    slug: "baseball",    count: 8 },
  { icon: "🏒", label: "Hockey",      slug: "hockey",      count: 15 },
  { icon: "🥊", label: "Boxe/MMA",    slug: "mma",         count: 6 },
  { icon: "🏐", label: "Volleyball",  slug: "volleyball",  count: 10 },
  { icon: "🎱", label: "Snooker",     slug: "snooker",     count: 4 },
  { icon: "🏉", label: "Rugby",       slug: "rugby",       count: 9 },
];

const QUICK_LINKS = [
  { icon: "🔴", label: "En direct maintenant", href: "/live", badge: "12" },
  { icon: "⭐", label: "Mes favoris",           href: "/favorites" },
  { icon: "📅", label: "Aujourd'hui",           href: "/?filter=today" },
  { icon: "🏆", label: "Top compétitions",      href: "/?filter=top" },
];

export function LeftSidebar() {
  const searchParams = useSearchParams();
  const activeSport = searchParams.get("sport");

  return (
    <div className="flex flex-col py-2 overflow-y-auto h-full">
      {/* Liens rapides */}
      <div className="px-2 mb-2">
        {QUICK_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="sidebar-item flex justify-between group">
            <span className="flex items-center gap-2.5">
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </span>
            {link.badge && (
              <span className="badge-live">{link.badge}</span>
            )}
          </Link>
        ))}
      </div>

      <div className="divider mx-2 mb-2" />

      {/* Sports */}
      <p className="px-4 text-[10px] font-semibold text-txt-muted uppercase tracking-widest mb-1">
        Sports
      </p>
      <div className="px-2">
        {SPORTS.map((sport) => (
          <Link
            key={sport.slug}
            href={`/?sport=${sport.slug}`}
            className={`sidebar-item flex justify-between ${activeSport === sport.slug ? "active" : ""}`}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base">{sport.icon}</span>
              <span>{sport.label}</span>
            </span>
            <span className="text-[11px] text-txt-muted">{sport.count}</span>
          </Link>
        ))}
      </div>

      <div className="divider mx-2 my-2" />

      {/* Jeu responsable */}
      <div className="px-3 py-2 mx-2 bg-bg-card rounded-lg border border-bg-border">
        <p className="text-[10px] text-txt-muted text-center leading-relaxed">
          🔞 Jeu réservé aux +18 ans<br/>
          <Link href="/responsible-gaming" className="text-green-500 hover:underline">
            Jeu responsable
          </Link>
        </p>
      </div>
    </div>
  );
}
