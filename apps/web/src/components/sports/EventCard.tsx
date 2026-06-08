"use client";

import Link from "next/link";
import { useBetSlipStore } from "@/store/betslip.store";
import type { EventDTO } from "@serenitybet/shared";
import { format, isToday, isTomorrow } from "date-fns";

export function EventCard({ event }: { event: EventDTO }) {
  const { addSelection, removeSelection, hasSelection } = useBetSlipStore();

  const mainMarket     = event.markets?.find((m) => m.type === "MATCH_WINNER");
  const ouMarket       = event.markets?.find((m) => m.type === "OVER_UNDER");
  const handicapMarket = event.markets?.find((m) => m.type === "HANDICAP");
  const totalMarkets   = event.markets?.length ?? 0;
  const startTime      = new Date(event.startTime);

  function formatTime() {
    if (event.status === "LIVE") return null;
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
    <div className="px-3 py-2.5 hover:bg-bg-hover transition-colors">
      {/* Ligne 1 : Heure + bouton Voir plus */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {event.status === "LIVE" ? (
            <span className="badge-live">
              <span className="w-1.5 h-1.5 bg-live rounded-full animate-pulse" />
              Live {event.minute ? `${event.minute}'` : ""}
            </span>
          ) : (
            <span className="badge-upcoming text-[11px]">{formatTime()}</span>
          )}
        </div>
        <Link
          href={`/match/${event.id}`}
          className="text-[10px] text-txt-muted hover:text-green-400 font-medium border border-bg-border px-2 py-0.5 rounded hover:border-green-500/50 transition-colors"
        >
          +{totalMarkets > 1 ? totalMarkets : ""}  marchés
        </Link>
      </div>

      {/* Ligne 2 : Équipes + Score + Cotes 1X2 */}
      <div className="flex items-center gap-2">
        {/* Équipes */}
        <div className="flex-1 min-w-0 space-y-0.5 mr-1">
          <p className="text-sm font-semibold text-txt-primary leading-tight truncate">{event.homeTeam}</p>
          <p className="text-sm font-semibold text-txt-primary leading-tight truncate">{event.awayTeam}</p>
        </div>

        {/* Score (live) ou VS */}
        {event.status === "LIVE" && event.homeScore !== undefined ? (
          <div className="flex flex-col items-center bg-live/10 border border-live/30 rounded-lg px-2 py-1 shrink-0">
            <span className="text-sm font-black text-live leading-none">{event.homeScore}</span>
            <span className="text-sm font-black text-live leading-none">{event.awayScore}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center bg-bg-input border border-bg-border rounded-lg px-2 py-1 shrink-0">
            <span className="text-[10px] font-bold text-txt-muted leading-none">VS</span>
          </div>
        )}

        {/* Cotes 1X2 */}
        {mainMarket ? (
          <div className="flex gap-1 shrink-0">
            {mainMarket.odds.slice(0, 3).map((odd) => (
              <button
                key={odd.id}
                onClick={() => handleOdd(mainMarket.id, odd.id, Number(odd.value), odd.label, mainMarket.name)}
                className={`odd-btn ${hasSelection(odd.id) ? "active" : ""}`}
              >
                <span className="odd-label">{odd.label}</span>
                <span className="odd-value">{Number(odd.value).toFixed(2)}</span>
              </button>
            ))}
          </div>
        ) : (
          <Link href={`/match/${event.id}`} className="text-[11px] text-green-400 shrink-0">
            Voir cotes →
          </Link>
        )}
      </div>

      {/* Ligne 3 : Autres marchés (O/U + Handicap) */}
      {(ouMarket || handicapMarket) && (
        <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-bg-border/50 flex-wrap">

          {/* Over/Under */}
          {ouMarket && (
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-txt-muted uppercase tracking-wide shrink-0 mr-0.5">O/U</span>
              {ouMarket.odds.slice(0, 2).map((odd) => (
                <button
                  key={odd.id}
                  onClick={() => handleOdd(ouMarket.id, odd.id, Number(odd.value), odd.label, ouMarket.name)}
                  className={`odd-btn text-[10px] ${hasSelection(odd.id) ? "active" : ""}`}
                >
                  <span className="odd-label text-[9px]">{odd.label}</span>
                  <span className="odd-value">{Number(odd.value).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Séparateur */}
          {ouMarket && handicapMarket && (
            <span className="w-px h-4 bg-bg-border shrink-0" />
          )}

          {/* Handicap */}
          {handicapMarket && (
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-txt-muted uppercase tracking-wide shrink-0 mr-0.5">HCP</span>
              {handicapMarket.odds.slice(0, 2).map((odd) => (
                <button
                  key={odd.id}
                  onClick={() => handleOdd(handicapMarket.id, odd.id, Number(odd.value), odd.label, handicapMarket.name)}
                  className={`odd-btn text-[10px] ${hasSelection(odd.id) ? "active" : ""}`}
                >
                  <span className="odd-label text-[9px]">{odd.label}</span>
                  <span className="odd-value">{Number(odd.value).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Si aucun marché secondaire : message pour aller sur la page du match */}
      {!ouMarket && !handicapMarket && totalMarkets <= 1 && (
        <div className="mt-1.5 pt-1.5 border-t border-bg-border/50">
          <Link href={`/match/${event.id}`}
            className="text-[10px] text-txt-muted hover:text-green-400 transition-colors">
            Voir tous les marchés disponibles →
          </Link>
        </div>
      )}
    </div>
  );
}
