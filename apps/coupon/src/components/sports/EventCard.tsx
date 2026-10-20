"use client";

import Link from "next/link";
import { useCouponStore } from "@/store/coupon.store";
import type { EventDTO } from "@serenitybet/shared";
import { format, isToday, isTomorrow } from "date-fns";

// Icône "statistiques" — lien vers la fiche match (tous les marchés).
function StatsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="7" width="4" height="14" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

// Largeur des 3 colonnes de cotes — partagée (en dur) avec l'en-tête "1 X 2"
// de CompetitionGroups (page.tsx) pour que les colonnes s'alignent.
export const ODDS_COLUMNS_WIDTH = "w-[168px] sm:w-[204px]";

export function EventCard({ event }: { event: EventDTO }) {
  const { addSelection, removeSelection, hasSelection } = useCouponStore();

  // Seul le résultat du match (1X2) est affiché dans la liste — tous les
  // autres marchés (plus/moins, handicap, BTTS, corners, cartons...) ne
  // sont accessibles qu'en cliquant sur le match.
  const mainMarket   = event.markets?.find((m) => m.type === "MATCH_WINNER");
  const totalMarkets = event.markets?.length ?? 0;
  const startTime    = new Date(event.startTime);

  function formatTime() {
    if (isToday(startTime))    return `Aujourd'hui ${format(startTime, "HH:mm")}`;
    if (isTomorrow(startTime)) return `Demain ${format(startTime, "HH:mm")}`;
    return format(startTime, "dd/MM · HH:mm");
  }

  function handleOdd(marketId: string, oddId: string, oddValue: number, oddLabel: string, marketName: string) {
    if (hasSelection(oddId)) removeSelection(oddId);
    else addSelection({
      eventId:    event.id,
      eventLabel: `${event.homeTeam} — ${event.awayTeam}`,
      marketId, marketName, oddId, oddLabel, oddValue,
    });
  }

  return (
    <div className="grid grid-cols-[1fr_auto] hover:bg-bg-hover transition-colors">
      {/* Équipes + heure + badge marchés — toute la zone mène à la fiche match */}
      <Link href={`/match/${event.id}`} className="min-w-0 py-2.5 px-3 flex flex-col justify-center gap-1 active:bg-bg-hover">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-bold text-txt-primary leading-snug truncate">{event.homeTeam}</p>
            <p className="text-sm font-bold text-txt-primary leading-snug truncate">{event.awayTeam}</p>
          </div>
          <span className="shrink-0 text-txt-muted mt-0.5">
            <StatsIcon />
          </span>
        </div>
        <div className="flex items-center gap-2">
          {event.status === "LIVE" ? (
            <span className="badge-live">
              <span className="w-1.5 h-1.5 bg-live rounded-full animate-pulse" />
              Live {event.minute ? `${event.minute}'` : ""}
              {event.homeScore !== undefined ? ` · ${event.homeScore}-${event.awayScore}` : ""}
            </span>
          ) : (
            <span className="text-[11px] text-txt-muted">{formatTime()}</span>
          )}
          {totalMarkets > 1 && (
            <span className="bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
              +{totalMarkets - 1}
            </span>
          )}
        </div>
      </Link>

      {/* Cotes 1 X 2 */}
      {mainMarket ? (
        <div className={`grid grid-cols-3 shrink-0 divide-x divide-bg-border border-l border-bg-border ${ODDS_COLUMNS_WIDTH}`}>
          {mainMarket.odds.slice(0, 3).map((odd) => (
            <button
              key={odd.id}
              onClick={() => handleOdd(mainMarket.id, odd.id, Number(odd.value), odd.label, mainMarket.name)}
              className={`flex items-center justify-center text-sm font-bold transition-colors ${
                hasSelection(odd.id) ? "bg-green-50 text-green-700" : "text-txt-primary hover:bg-bg-hover"
              }`}
            >
              {Number(odd.value).toFixed(2)}
            </button>
          ))}
        </div>
      ) : (
        <Link
          href={`/match/${event.id}`}
          className={`flex items-center justify-center text-[11px] text-green-700 shrink-0 border-l border-bg-border ${ODDS_COLUMNS_WIDTH}`}
        >
          Voir cotes →
        </Link>
      )}
    </div>
  );
}
