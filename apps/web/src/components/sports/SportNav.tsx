"use client";

import Link from "next/link";

const SPORTS_TABS = [
  { icon: "⚽", label: "Football",    slug: "football" },
  { icon: "🏀", label: "Basketball",  slug: "basketball" },
  { icon: "🎾", label: "Tennis",      slug: "tennis" },
  { icon: "🏈", label: "Américain",   slug: "american-football" },
  { icon: "⚾", label: "Baseball",    slug: "baseball" },
  { icon: "🏒", label: "Hockey",      slug: "hockey" },
  { icon: "🥊", label: "Boxe/MMA",   slug: "mma" },
  { icon: "🏐", label: "Volley",      slug: "volleyball" },
  { icon: "🏉", label: "Rugby",       slug: "rugby" },
  { icon: "🎱", label: "Snooker",     slug: "snooker" },
];

export function SportNav({ activeSport }: { activeSport?: string }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none border-b border-bg-border pb-0 -mx-3 lg:-mx-4 px-3 lg:px-4">
      {/* Tous */}
      <Link
        href="/"
        className={`sport-tab shrink-0 ${!activeSport ? "active" : ""}`}
      >
        <span>🏟️</span>
        <span>Tous</span>
      </Link>

      {SPORTS_TABS.map((sport) => (
        <Link
          key={sport.slug}
          href={`/?sport=${sport.slug}`}
          className={`sport-tab shrink-0 ${activeSport === sport.slug ? "active" : ""}`}
        >
          <span>{sport.icon}</span>
          <span>{sport.label}</span>
        </Link>
      ))}
    </div>
  );
}
