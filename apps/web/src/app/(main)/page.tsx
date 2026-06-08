import Link from "next/link";
import { EventCard } from "@/components/sports/EventCard";
import { SportNav } from "@/components/sports/SportNav";
import { DateTabs } from "@/components/sports/DateTabs";
import type { EventDTO } from "@serenitybet/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

// ─── Drapeaux par pays ────────────────────────────────────────────────────────
const COUNTRY_FLAG: Record<string, string> = {
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", France: "🇫🇷", Spain: "🇪🇸", Italy: "🇮🇹", Germany: "🇩🇪",
  Europe: "🇪🇺", Brazil: "🇧🇷", Argentina: "🇦🇷", USA: "🇺🇸", Mexico: "🇲🇽",
  Japan: "🇯🇵", Turkey: "🇹🇷", Australia: "🇦🇺", Netherlands: "🇳🇱", Portugal: "🇵🇹",
  Africa: "🌍", World: "🌐", Chad: "🇹🇩", "South America": "🌎",
};

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function getEvents(sport?: string, date?: string) {
  try {
    const params = new URLSearchParams({ limit: "150" });
    if (sport) params.set("sport", sport);
    if (date && date !== "all") params.set("date", date);
    const res = await fetch(`${API_URL}/sports/events?${params}`, {
      next: { revalidate: 60 }, // cache 60s
    });
    if (!res.ok) return { events: [], total: 0 };
    const json = await res.json();
    return json.data ?? { events: [], total: 0 };
  } catch {
    return { events: [], total: 0 };
  }
}

// ─── Groupement compétition ───────────────────────────────────────────────────
interface CompGroup {
  compId:   string;
  compName: string;
  country:  string;
  flag:     string;
  sportIcon: string;
  sportName: string;
  sportSlug: string;
  events:   EventDTO[];
}

function groupByCompetition(events: EventDTO[]): CompGroup[] {
  const map = new Map<string, CompGroup>();
  for (const ev of events) {
    const key = ev.competition?.id ?? "other";
    if (!map.has(key)) {
      const country = (ev.competition as any)?.country ?? "";
      map.set(key, {
        compId:    key,
        compName:  ev.competition?.name ?? "Autre",
        country,
        flag:      COUNTRY_FLAG[country] ?? "🌐",
        sportIcon: (ev as any).sport?.icon ?? (ev.competition as any)?.sport?.icon ?? "🏅",
        sportName: (ev as any).sport?.name ?? (ev.competition as any)?.sport?.name ?? "",
        sportSlug: (ev as any).sport?.slug ?? (ev.competition as any)?.sport?.slug ?? "",
        events:    [],
      });
    }
    map.get(key)!.events.push(ev);
  }
  return [...map.values()];
}

// ─── Groupement par sport ─────────────────────────────────────────────────────
interface SportGroup {
  slug: string;
  name: string;
  icon: string;
  competitions: CompGroup[];
  liveCount: number;
}

function groupBySport(events: EventDTO[]): SportGroup[] {
  const byComp = groupByCompetition(events);
  const sportMap = new Map<string, SportGroup>();
  for (const comp of byComp) {
    const key = comp.sportSlug || "other";
    if (!sportMap.has(key)) {
      sportMap.set(key, { slug: key, name: comp.sportName, icon: comp.sportIcon, competitions: [], liveCount: 0 });
    }
    const sg = sportMap.get(key)!;
    sg.competitions.push(comp);
    sg.liveCount += comp.events.filter(e => e.status === "LIVE").length;
  }
  // Tri : Football d'abord, puis par nombre d'événements
  const ORDER = ["football", "basketball", "tennis", "hockey", "mma", "baseball", "american-football"];
  return [...sportMap.values()].sort((a, b) => {
    const ia = ORDER.indexOf(a.slug), ib = ORDER.indexOf(b.slug);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return b.competitions.reduce((s, c) => s + c.events.length, 0)
         - a.competitions.reduce((s, c) => s + c.events.length, 0);
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; date?: string }>;
}) {
  const { sport, date } = await searchParams;
  const { events, total } = await getEvents(sport, date);
  const eventsArr = (events ?? []) as EventDTO[];

  const liveEvents = eventsArr.filter(e => e.status === "LIVE");

  return (
    <div className="space-y-0">
      {/* Onglets sports */}
      <SportNav activeSport={sport} />

      <div className="space-y-3 pt-3">

        {/* Navigation par date */}
        <DateTabs activeSport={sport} />

        {/* Compteur */}
        {eventsArr.length > 0 && (
          <p className="text-[11px] text-txt-muted">
            {total ?? eventsArr.length} événement{(total ?? eventsArr.length) > 1 ? "s" : ""}
            {liveEvents.length > 0 && (
              <span className="ml-2 text-live font-semibold">
                · <span className="animate-pulse">●</span> {liveEvents.length} en direct
              </span>
            )}
          </p>
        )}

        {/* Vide */}
        {eventsArr.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-5xl mb-4">📅</span>
            <p className="text-txt-primary font-semibold mb-1">Aucun match pour cette période</p>
            <p className="text-txt-muted text-sm mb-4">
              Essayez un autre filtre de date ou revenez plus tard.
            </p>
            <Link href="/" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-500 transition-colors">
              Voir tous les matchs
            </Link>
          </div>
        ) : sport ? (
          // ── Vue sport sélectionné : groupé par compétition ───────────────────
          <CompetitionGroups groups={groupByCompetition(eventsArr)} />
        ) : (
          // ── Vue "Tous" : groupé par sport puis compétition ───────────────────
          <AllSportsView sportGroups={groupBySport(eventsArr)} />
        )}

        {/* Mention légale */}
        {eventsArr.length > 0 && (
          <div className="text-center py-4 border-t border-bg-border">
            <p className="text-[11px] text-txt-muted">
              🔞 Paris réservés aux +18 ans · Licence Serenitybet (Tchad) ·{" "}
              <Link href="/responsible-gaming" className="text-green-500 hover:underline">Jeu responsable</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Composant : vue "Tous les sports" ───────────────────────────────────────

function AllSportsView({ sportGroups }: { sportGroups: SportGroup[] }) {
  return (
    <div className="space-y-4">
      {sportGroups.map(sg => (
        <div key={sg.slug}>
          {/* En-tête sport */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">{sg.icon}</span>
            <Link
              href={`/?sport=${sg.slug}`}
              className="text-sm font-black text-txt-primary uppercase tracking-wide hover:text-green-400 transition-colors"
            >
              {sg.name}
            </Link>
            <div className="h-px flex-1 bg-bg-border" />
            {sg.liveCount > 0 && (
              <span className="text-[10px] font-bold text-live flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse inline-block" />
                {sg.liveCount} live
              </span>
            )}
            <Link
              href={`/?sport=${sg.slug}`}
              className="text-[11px] text-txt-muted hover:text-green-400 transition-colors shrink-0"
            >
              Tout voir ›
            </Link>
          </div>

          {/* Compétitions de ce sport */}
          <CompetitionGroups groups={sg.competitions} maxPerGroup={5} />
        </div>
      ))}
    </div>
  );
}

// ─── Composant : liste de groupes par compétition ────────────────────────────

function CompetitionGroups({
  groups,
  maxPerGroup,
}: {
  groups: CompGroup[];
  maxPerGroup?: number;
}) {
  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const shown    = maxPerGroup ? group.events.slice(0, maxPerGroup) : group.events;
        const hidden   = maxPerGroup ? Math.max(0, group.events.length - maxPerGroup) : 0;
        const liveCount = group.events.filter(e => e.status === "LIVE").length;

        return (
          <div key={group.compId} className="overflow-hidden rounded-xl border border-bg-border bg-bg-secondary">
            {/* En-tête compétition */}
            <div className="flex items-center gap-2 px-3 py-2 bg-bg-card border-b border-bg-border">
              <span className="text-sm">{group.flag}</span>
              <span className="text-xs font-bold text-txt-primary uppercase tracking-wide truncate">
                {group.compName}
              </span>
              {group.country && (
                <span className="text-[10px] text-txt-muted hidden sm:block shrink-0">
                  · {group.country}
                </span>
              )}
              {liveCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-live shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse inline-block" />
                  {liveCount} live
                </span>
              )}
              <span className="ml-auto text-[10px] text-txt-muted shrink-0">
                {group.events.length} match{group.events.length > 1 ? "s" : ""}
              </span>
            </div>

            {/* Ligne d'entêtes des cotes */}
            <div className="hidden sm:grid grid-cols-[1fr_auto] items-center px-3 py-1 bg-bg-primary border-b border-bg-border/50">
              <span className="text-[9px] uppercase tracking-widest text-txt-muted">Match</span>
              <div className="flex gap-1 mr-12">
                {["1", "X", "2"].map(l => (
                  <span key={l} className="text-[9px] uppercase tracking-widest text-txt-muted w-12 text-center">{l}</span>
                ))}
              </div>
            </div>

            {/* Matchs */}
            <div className="divide-y divide-bg-border">
              {shown.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>

            {/* "Voir plus" si tronqué */}
            {hidden > 0 && (
              <Link
                href={`/?sport=${group.sportSlug}`}
                className="flex items-center justify-center gap-1 px-3 py-2 text-[11px] text-green-400 hover:text-green-300 hover:bg-green-600/5 transition-colors border-t border-bg-border"
              >
                +{hidden} autres matchs · Voir tout {group.compName} ›
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
