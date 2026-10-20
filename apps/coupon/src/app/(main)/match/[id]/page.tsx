"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCouponStore } from "@/store/coupon.store";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

// Les 18 types de marché que notre sync TheOddsAPI alimente (voir
// packages/api/src/services/odds.service.ts) — tous doivent pouvoir être
// consultés et sélectionnés ici, pas seulement un sous-ensemble.
// FIRST_HALF_WINNER/SECOND_HALF_WINNER/CORNERS_*/CARDS_* ne sont pas
// réglables automatiquement (TheOddsAPI ne fournit pas ces stats via
// /scores) — un trader saisit le résultat manuellement une fois le match
// terminé, le ticket se règle alors normalement.
const MARKET_LABELS: Record<string, string> = {
  MATCH_WINNER:        "🏆 Résultat du match (1X2)",
  DOUBLE_CHANCE:       "🎯 Double chance",
  OVER_UNDER:          "📊 Plus/Moins de buts",
  BOTH_TEAMS_SCORE:    "⚽ Les deux équipes marquent",
  HANDICAP:            "⚖️ Handicap asiatique",
  CORRECT_SCORE:       "🔢 Score exact",
  TEAM_TOTALS:         "📐 Totaux par équipe",
  DRAW_NO_BET:         "🤝 Remboursé si match nul",
  ALTERNATE_TOTALS:    "📈 Plus/Moins (autres lignes)",
  ALTERNATE_SPREADS:   "📉 Handicap (autres lignes)",
  FIRST_HALF_WINNER:   "⏱ Résultat 1ère mi-temps",
  SECOND_HALF_WINNER:  "⏱ Résultat 2nde mi-temps",
  CORNERS_TOTAL:       "🚩 Plus/Moins de corners",
  CORNERS_HANDICAP:    "🚩 Handicap corners",
  CARDS_TOTAL:         "🟨 Plus/Moins de cartons",
  CARDS_HANDICAP:      "🟨 Handicap cartons",
  FIRST_GOAL_SCORER:   "🥅 Premier buteur",
  HALF_TIME_RESULT:    "⏱ Résultat à la mi-temps",
};

// Ordre d'affichage des onglets — les marchés les plus pariés en premier.
const MARKET_TAB_ORDER = [
  "MATCH_WINNER", "DOUBLE_CHANCE", "OVER_UNDER", "BOTH_TEAMS_SCORE",
  "HANDICAP", "CORRECT_SCORE", "TEAM_TOTALS", "DRAW_NO_BET",
  "ALTERNATE_TOTALS", "ALTERNATE_SPREADS",
  "FIRST_HALF_WINNER", "SECOND_HALF_WINNER",
  "CORNERS_TOTAL", "CORNERS_HANDICAP", "CARDS_TOTAL", "CARDS_HANDICAP",
  "FIRST_GOAL_SCORER", "HALF_TIME_RESULT",
];

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { addSelection, removeSelection, hasSelection } = useCouponStore();

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetch(`${API}/sports/events/${id}`)
      .then(r => r.json())
      .then(d => { if (d.data) setEvent(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  function handleOdd(marketId: string, oddId: string, oddValue: number, oddLabel: string, marketName: string) {
    if (!event) return;
    if (hasSelection(oddId)) removeSelection(oddId);
    else addSelection({
      eventId:    event.id,
      eventLabel: `${event.homeTeam} — ${event.awayTeam}`,
      startTime:  event.startTime,
      marketId, marketName, oddId, oddLabel, oddValue,
    });
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
    </div>
  );

  if (!event) return (
    <div className="text-center py-20 text-txt-muted">
      <p className="text-4xl mb-3">⚽</p>
      <p>Match introuvable</p>
    </div>
  );

  const markets = event.markets ?? [];
  const totalOdds = markets.reduce((acc: number, m: any) => acc + (m.odds?.length ?? 0), 0);

  // Onglets générés depuis les marchés réellement disponibles sur ce match
  // (pas une liste figée) — tout type synchronisé par TheOddsAPI y apparaît.
  const availableTypes = [...new Set(markets.map((m: any) => m.type as string))];
  const tabs = ["all", ...MARKET_TAB_ORDER.filter((t) => availableTypes.includes(t))];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <button onClick={() => router.back()} className="text-sm text-txt-muted hover:text-green-700 flex items-center gap-1">
        ← Retour
      </button>

      <div className="bg-bg-secondary border border-bg-border rounded-2xl overflow-hidden">
        <div className="bg-bg-card px-4 py-2 border-b border-bg-border text-xs text-txt-muted flex items-center justify-between">
          <span>{event.competition?.sport?.name} · {event.competition?.name}</span>
          {event.status === "LIVE"
            ? <span className="badge-live"><span className="w-1.5 h-1.5 bg-live rounded-full animate-pulse" />Live</span>
            : <span>{format(new Date(event.startTime), "d MMMM yyyy · HH:mm", { locale: fr })}</span>
          }
        </div>
        <div className="p-6 text-center">
          <div className="flex items-center justify-center gap-6">
            <div className="flex-1 text-right">
              <p className="text-xl font-black text-txt-primary">{event.homeTeam}</p>
              <p className="text-xs text-txt-muted mt-1">Domicile</p>
            </div>
            <div className="text-center">
              {event.status === "LIVE" ? (
                <div className="bg-live/10 border border-live/30 rounded-xl px-5 py-2">
                  <p className="text-3xl font-black text-live">{event.homeScore ?? 0} - {event.awayScore ?? 0}</p>
                  <p className="text-xs text-live">{event.minute ?? 0}'</p>
                </div>
              ) : (
                <div className="bg-bg-card border border-bg-border rounded-xl px-5 py-3">
                  <p className="text-xl font-black text-txt-muted">VS</p>
                </div>
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="text-xl font-black text-txt-primary">{event.awayTeam}</p>
              <p className="text-xs text-txt-muted mt-1">Extérieur</p>
            </div>
          </div>
        </div>
        <div className="px-4 py-2 border-t border-bg-border bg-bg-card text-center text-xs text-txt-muted">
          {totalOdds} cotes disponibles · {markets.length} marchés
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto scrollbar-none">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab ? "bg-green-600 text-white" : "bg-bg-card border border-bg-border text-txt-muted hover:text-txt-primary"
            }`}>
            {tab === "all" ? "Tous les marchés" : MARKET_LABELS[tab] ?? tab}
          </button>
        ))}
      </div>

      {markets.length === 0 ? (
        <div className="text-center py-12 text-txt-muted">
          <p className="text-3xl mb-2">📊</p>
          <p>Cotes non disponibles pour ce match</p>
        </div>
      ) : (
        <div className="space-y-3">
          {markets
            .filter((m: any) => activeTab === "all" || m.type === activeTab)
            .map((market: any) => (
              <div key={market.id} className="bg-bg-secondary border border-bg-border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-bg-card border-b border-bg-border">
                  <p className="text-sm font-semibold text-txt-primary">
                    {MARKET_LABELS[market.type] ?? market.name}
                  </p>
                </div>
                <div className={`p-3 grid gap-2 ${
                  (market.odds?.length ?? 0) === 3 ? "grid-cols-3" :
                  (market.odds?.length ?? 0) <= 2 ? "grid-cols-2" :
                  "grid-cols-2 sm:grid-cols-3"
                }`}>
                  {market.odds?.map((odd: any) => (
                    <button key={odd.id}
                      onClick={() => handleOdd(market.id, odd.id, Number(odd.value), odd.label, market.name)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${
                        hasSelection(odd.id)
                          ? "bg-green-600/20 border-green-600/60 text-green-700"
                          : "bg-bg-card border-bg-border hover:border-green-600/40 hover:bg-green-600/5"
                      }`}>
                      <span className="text-sm text-txt-secondary">{odd.label}</span>
                      <span className={`text-sm font-black ${hasSelection(odd.id) ? "text-green-700" : "text-txt-primary"}`}>
                        {Number(odd.value).toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}
