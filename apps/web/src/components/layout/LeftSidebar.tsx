"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

interface SportItem {
  slug:  string;
  name:  string;
  icon:  string;
  count: number;
}

interface CompItem {
  id:      string;
  name:    string;
  country: string;
  count:   number;
}

const STATIC_SPORTS: SportItem[] = [
  { icon: "⚽", label: "Football",         slug: "football",          count: 0 } as any,
  { icon: "🏀", label: "Basketball",       slug: "basketball",        count: 0 } as any,
  { icon: "🎾", label: "Tennis",           slug: "tennis",            count: 0 } as any,
  { icon: "🏈", label: "Américain",        slug: "american-football", count: 0 } as any,
  { icon: "⚾", label: "Baseball",         slug: "baseball",          count: 0 } as any,
  { icon: "🏒", label: "Hockey",           slug: "hockey",            count: 0 } as any,
  { icon: "🥊", label: "Boxe/MMA",         slug: "mma",               count: 0 } as any,
  { icon: "🏐", label: "Volleyball",       slug: "volleyball",        count: 0 } as any,
  { icon: "🎱", label: "Snooker",          slug: "snooker",           count: 0 } as any,
  { icon: "🏉", label: "Rugby",            slug: "rugby",             count: 0 } as any,
];

const COUNTRY_FLAG: Record<string, string> = {
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", France: "🇫🇷", Spain: "🇪🇸", Italy: "🇮🇹", Germany: "🇩🇪",
  Europe: "🇪🇺", Brazil: "🇧🇷", Argentina: "🇦🇷", USA: "🇺🇸", Mexico: "🇲🇽",
  Japan: "🇯🇵", Turkey: "🇹🇷", Australia: "🇦🇺", Netherlands: "🇳🇱", Portugal: "🇵🇹",
  Africa: "🌍", World: "🌐", Chad: "🇹🇩",
};

export function LeftSidebar() {
  const searchParams  = useSearchParams();
  const activeSport   = searchParams.get("sport") ?? "";
  const activeDate    = searchParams.get("date") ?? "";

  const [sports,       setSports]       = useState<SportItem[]>([]);
  const [competitions, setCompetitions] = useState<CompItem[]>([]);
  const [liveCount,    setLiveCount]    = useState(0);
  const [loading,      setLoading]      = useState(true);

  // Charge les sports avec leur nombre d'événements
  useEffect(() => {
    fetch(`${API_URL}/sports/events?limit=200`)
      .then(r => r.json())
      .then(d => {
        const events: any[] = d.data?.events ?? [];
        setLiveCount(events.filter((e: any) => e.status === "LIVE").length);

        // Compte par sport
        const countMap: Record<string, number> = {};
        for (const ev of events) {
          const slug = ev.competition?.sport?.slug ?? "";
          countMap[slug] = (countMap[slug] ?? 0) + 1;
        }

        setSports(
          STATIC_SPORTS.map((s: any) => ({ ...s, count: countMap[s.slug] ?? 0 }))
            .filter((s: any) => s.count > 0)
        );
      })
      .catch(() => setSports(STATIC_SPORTS.filter(() => false)))
      .finally(() => setLoading(false));
  }, []);

  // Charge les compétitions quand un sport est sélectionné
  useEffect(() => {
    if (!activeSport) { setCompetitions([]); return; }
    fetch(`${API_URL}/sports/events?sport=${activeSport}&limit=200`)
      .then(r => r.json())
      .then(d => {
        const events: any[] = d.data?.events ?? [];
        const compMap: Record<string, CompItem> = {};
        for (const ev of events) {
          const cid = ev.competition?.id ?? "other";
          if (!compMap[cid]) {
            compMap[cid] = {
              id:      cid,
              name:    ev.competition?.name ?? "Autre",
              country: ev.competition?.country ?? "",
              count:   0,
            };
          }
          compMap[cid].count++;
        }
        setCompetitions(Object.values(compMap).sort((a, b) => b.count - a.count));
      })
      .catch(() => setCompetitions([]));
  }, [activeSport]);

  function buildHref(sportSlug: string) {
    const p = new URLSearchParams();
    p.set("sport", sportSlug);
    if (activeDate) p.set("date", activeDate);
    return `/?${p.toString()}`;
  }

  return (
    <div className="flex flex-col py-2 overflow-y-auto h-full">

      {/* Liens rapides */}
      <div className="px-2 mb-2">
        <Link href="/live" className="sidebar-item flex justify-between group">
          <span className="flex items-center gap-2.5">
            <span>🔴</span>
            <span>En direct maintenant</span>
          </span>
          {liveCount > 0 && (
            <span className="badge-live">{liveCount}</span>
          )}
        </Link>
        <Link href="/favorites" className="sidebar-item flex justify-between group">
          <span className="flex items-center gap-2.5"><span>⭐</span><span>Mes favoris</span></span>
        </Link>
        <Link href="/?date=today" className="sidebar-item flex justify-between group">
          <span className="flex items-center gap-2.5"><span>📅</span><span>Aujourd'hui</span></span>
        </Link>
        <Link href="/?date=tomorrow" className="sidebar-item flex justify-between group">
          <span className="flex items-center gap-2.5"><span>📆</span><span>Demain</span></span>
        </Link>
      </div>

      <div className="divider mx-2 mb-2" />

      {/* Sports */}
      <p className="px-4 text-[10px] font-semibold text-txt-muted uppercase tracking-widest mb-1">Sports</p>
      <div className="px-2">
        {/* Lien "Tous" */}
        <Link
          href={activeDate ? `/?date=${activeDate}` : "/"}
          className={`sidebar-item flex justify-between ${!activeSport ? "active" : ""}`}
        >
          <span className="flex items-center gap-2.5">
            <span className="text-base">🏟️</span>
            <span>Tous les sports</span>
          </span>
        </Link>

        {loading ? (
          <div className="space-y-1 py-1">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-8 bg-bg-border/40 rounded-lg animate-pulse mx-1" />
            ))}
          </div>
        ) : (
          sports.map((sport: any) => (
            <Link
              key={sport.slug}
              href={buildHref(sport.slug)}
              className={`sidebar-item flex justify-between ${activeSport === sport.slug ? "active" : ""}`}
            >
              <span className="flex items-center gap-2.5">
                <span className="text-base">{sport.icon}</span>
                <span>{sport.label ?? sport.name}</span>
              </span>
              <span className="text-[11px] text-txt-muted">{sport.count}</span>
            </Link>
          ))
        )}
      </div>

      {/* Compétitions du sport sélectionné */}
      {activeSport && competitions.length > 0 && (
        <>
          <div className="divider mx-2 my-2" />
          <p className="px-4 text-[10px] font-semibold text-txt-muted uppercase tracking-widest mb-1">
            Compétitions
          </p>
          <div className="px-2">
            {competitions.map(comp => (
              <a
                key={comp.id}
                href={`/?sport=${activeSport}#comp-${comp.id}`}
                className="sidebar-item flex justify-between text-sm"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0">{COUNTRY_FLAG[comp.country] ?? "🌐"}</span>
                  <span className="truncate">{comp.name}</span>
                </span>
                <span className="text-[11px] text-txt-muted shrink-0">{comp.count}</span>
              </a>
            ))}
          </div>
        </>
      )}

      <div className="divider mx-2 my-2" />

      {/* Jeu responsable */}
      <div className="px-3 py-2 mx-2 bg-bg-card rounded-lg border border-bg-border">
        <p className="text-[10px] text-txt-muted text-center leading-relaxed">
          🔞 Jeu réservé aux +18 ans<br/>
          <Link href="/responsible-gaming" className="text-green-500 hover:underline">Jeu responsable</Link>
        </p>
      </div>
    </div>
  );
}
