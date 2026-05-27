import { EventCard } from "@/components/sports/EventCard";
import { SportNav } from "@/components/sports/SportNav";
import type { EventDTO } from "@serenitybet/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function getEvents(sport?: string) {
  try {
    const params = new URLSearchParams({ limit: "50" });
    if (sport) params.set("sport", sport);
    const res = await fetch(`${API_URL}/sports/events?${params}`, {
      cache: "no-store",
    });
    if (!res.ok) return { events: [] };
    const json = await res.json();
    return json.data ?? { events: [] };
  } catch {
    return { events: [] };
  }
}

/** Regroupe les événements par compétition */
function groupByCompetition(events: EventDTO[]) {
  const map = new Map<string, { name: string; country: string; icon: string; events: EventDTO[] }>();
  for (const ev of events) {
    const key = ev.competition?.id ?? "other";
    if (!map.has(key)) {
      map.set(key, {
        name: ev.competition?.name ?? "Compétition",
        country: ev.competition?.country ?? "",
        icon: ev.sport?.icon ?? "⚽",
        events: [],
      });
    }
    map.get(key)!.events.push(ev);
  }
  return [...map.values()];
}

const PROMO_BANNERS = [
  {
    id: 1,
    title: "Bonus Bienvenue",
    sub: "100% jusqu'à 50 000 XAF sur votre 1er dépôt",
    badge: "NOUVEAU",
    color: "from-green-900/60 to-green-600/20",
    icon: "🎁",
  },
  {
    id: 2,
    title: "Pari Remboursé",
    sub: "Si votre 1er pari est perdant, remboursé jusqu'à 5 000 XAF",
    badge: "OFFRE",
    color: "from-blue-900/60 to-blue-600/20",
    icon: "🛡️",
  },
  {
    id: 3,
    title: "Cote Boostée du jour",
    sub: "Nigeria vs Cameroun — Cote spéciale 4.50 au lieu de 3.10",
    badge: "BOOST",
    color: "from-amber-900/60 to-amber-600/20",
    icon: "⚡",
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; filter?: string }>;
}) {
  const { sport } = await searchParams;
  const { events } = await getEvents(sport);
  const groups = groupByCompetition(events as EventDTO[]);

  return (
    <div className="space-y-0">
      {/* Onglets sports */}
      <SportNav activeSport={sport} />

      <div className="space-y-4 pt-4">
        {/* Bannières promotionnelles */}
        {!sport && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PROMO_BANNERS.map((promo) => (
              <div
                key={promo.id}
                className={`relative overflow-hidden rounded-xl border border-bg-border bg-gradient-to-r ${promo.color} p-3.5 cursor-pointer hover:brightness-110 transition-all`}
              >
                <span className="absolute top-2 right-2 text-[10px] font-black px-2 py-0.5 bg-green-600 text-white rounded-full">
                  {promo.badge}
                </span>
                <div className="flex items-start gap-2.5">
                  <span className="text-2xl mt-0.5">{promo.icon}</span>
                  <div>
                    <p className="font-bold text-txt-primary text-sm leading-tight">{promo.title}</p>
                    <p className="text-xs text-txt-secondary mt-0.5 leading-relaxed">{promo.sub}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Matchs en direct (badge) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-live rounded-full animate-pulse" />
            <span className="text-xs font-bold text-live uppercase tracking-wider">En direct</span>
          </div>
          <div className="h-px flex-1 bg-bg-border" />
          <a href="/live" className="text-[11px] text-txt-muted hover:text-green-400 transition-colors">
            Voir tout ›
          </a>
        </div>

        {/* Événements groupés par compétition */}
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-5xl mb-4">⚽</span>
            <p className="text-txt-primary font-semibold mb-1">Aucun match disponible</p>
            <p className="text-txt-muted text-sm">
              Les matchs apparaîtront ici dès que les cotes seront disponibles.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.name} className="overflow-hidden rounded-xl border border-bg-border">
                {/* En-tête compétition */}
                <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border-b border-bg-border">
                  <span className="text-sm">{group.icon}</span>
                  <span className="text-xs font-bold text-txt-primary uppercase tracking-wide">
                    {group.name}
                  </span>
                  {group.country && (
                    <span className="text-[10px] text-txt-muted">· {group.country}</span>
                  )}
                  <span className="ml-auto text-[10px] text-txt-muted">
                    {group.events.length} match{group.events.length > 1 ? "s" : ""}
                  </span>
                </div>

                {/* Liste des matchs */}
                <div className="divide-y divide-bg-border">
                  {group.events.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bas de page — mention responsable */}
        <div className="text-center py-4 border-t border-bg-border">
          <p className="text-[11px] text-txt-muted">
            🔞 Paris sportifs réservés aux personnes de 18 ans et plus · Jouez de façon responsable ·{" "}
            <a href="/responsible-gaming" className="text-green-500 hover:underline">
              Aide
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
