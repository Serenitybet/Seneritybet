"use client";

import { useBetSlipStore } from "@/store/betslip.store";
import type { EventDTO } from "@serenitybet/shared";
import { format, isToday, isTomorrow } from "date-fns";

export function EventCard({ event }: { event: EventDTO }) {
  const { addSelection, removeSelection, hasSelection } = useBetSlipStore();

  const mainMarket = event.markets?.find((m) => m.type === "MATCH_WINNER");
  const ouMarket   = event.markets?.find((m) => m.type === "OVER_UNDER");
  const startTime  = new Date(event.startTime);

  function formatTime() {
    if (event.status === "LIVE") return null;
    if (isToday(startTime))    return `Aujourd'hui ${format(startTime, "HH:mm")}`;
    if (isTomorrow(startTime)) return `Demain ${format(startTime, "HH:mm")}`;
    return format(startTime, "dd/MM HH:mm");
  }

  function handleOdd(marketId: string, oddId: string, oddValue: number, oddLabel: string, marketName: string) {
    if (hasSelection(oddId)) {
      removeSelection(oddId);
    } else {
      addSelection({
        eventId: event.id,
        eventLabel: `${event.homeTeam} — ${event.awayTeam}`,
        marketId, marketName, oddId, oddLabel, oddValue,
      });
    }
  }

  return (
    <div className="px-3 py-2.5 hover:bg-bg-hover transition-colors duration-150 group">
      {/* Ligne du haut : heure + statut live */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {event.status === "LIVE" ? (
            <span className="badge-live">
              <span className="w-1.5 h-1.5 bg-live rounded-full animate-pulse" />
              Live {event.minute ? `${event.minute}'` : ""}
            </span>
          ) : (
            <span className="badge-upcoming">{formatTime()}</span>
          )}
        </div>
        <button className="text-[11px] text-txt-muted hover:text-green-400 transition-colors flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <span>+{(event.markets?.length ?? 1) + 12}</span>
          <span className="text-xs">›</span>
        </button>
      </div>

      {/* Corps : équipes + cotes */}
      <div className="flex items-center gap-2">
        {/* Équipes */}
        <div className="flex-1 min-w-0 space-y-1 mr-2">
          <p className="text-sm font-semibold text-txt-primary leading-tight truncate">{event.homeTeam}</p>
          <p className="text-sm font-semibold text-txt-primary leading-tight truncate">{event.awayTeam}</p>
        </div>

        {/* Score ou VS */}
        {event.status === "LIVE" && event.homeScore !== undefined && event.homeScore !== null ? (
          <div className="flex flex-col items-center justify-center bg-live/10 border border-live/30 rounded-lg px-2.5 py-1 min-w-[34px] shrink-0">
            <span className="text-base font-black text-live leading-none">{event.homeScore}</span>
            <span className="text-base font-black text-live leading-none">{event.awayScore}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center bg-bg-input border border-bg-border rounded-lg px-2.5 py-1 min-w-[34px] shrink-0">
            <span className="text-[10px] font-bold text-txt-muted leading-none">VS</span>
          </div>
        )}

        {/* Cotes 1X2 */}
        {mainMarket && (
          <div className="flex gap-1">
            {mainMarket.odds.map((odd) => (
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
        )}
      </div>

      {/* Cotes O/U (optionnel, ligne compacte) */}
      {ouMarket && (
        <div className="flex gap-1 mt-1.5 ml-auto w-fit">
          {ouMarket.odds.map((odd) => (
            <button
              key={odd.id}
              onClick={() => handleOdd(ouMarket.id, odd.id, Number(odd.value), odd.label, ouMarket.name)}
              className={`odd-btn ${hasSelection(odd.id) ? "active" : ""}`}
            >
              <span className="odd-label">{odd.label}</span>
              <span className="odd-value">{Number(odd.value).toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
