"use client";

import Link from "next/link";

// Football/basketball/tennis seulement (demande explicite du 31/10/2026) —
// les autres sports ne sont plus synchronisés (voir SPORTS_CONFIG,
// odds.service.ts), ces onglets n'auraient donc plus jamais de matchs à
// afficher.
const SPORTS_TABS = [
  { icon: "⚽", label: "Football",    slug: "football" },
  { icon: "🏀", label: "Basketball",  slug: "basketball" },
  { icon: "🎾", label: "Tennis",      slug: "tennis" },
];

export function SportNav({ activeSport }: { activeSport?: string }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none border-b border-bg-border pb-0 -mx-3 lg:-mx-4 px-3 lg:px-4">
      <Link href="/" className={`sport-tab shrink-0 ${!activeSport ? "active" : ""}`}>
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
