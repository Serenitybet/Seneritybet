"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { api } from "@/lib/api";

interface Odd { id: string; label: string; value: string; isActive: boolean; }
interface Market { id: string; name: string; odds: Odd[]; isSuspended: boolean; isActive: boolean; }
interface Event {
  id: string; homeTeam: string; awayTeam: string; startTime: string;
  competition: { name: string };
  markets: Market[];
}

interface Selection {
  eventId: string; eventLabel: string; marketId: string; marketName: string;
  oddId: string; oddLabel: string; oddValue: number;
}

interface TicketResult {
  code: string;
  stakeXAF: number;
  totalOdds: number;
  potentialWinXAF: number;
  createdAt: string;
  items: { oddValue: number; market: { name: string; event: { homeTeam: string; awayTeam: string } }; odd: { label: string } }[];
}

const QUICK_STAKES = [500, 1000, 2000, 5000, 10000, 25000];

function dayKey(d: Date) { return d.toISOString().slice(0, 10); }

const DAY_LABELS = ["Aujourd'hui", "Demain", "J+2", "J+3", "J+4", "J+5", "J+6"];

export default function TpeTicketPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [stakeXAF, setStakeXAF] = useState("");
  const [placing, setPlacing] = useState(false);
  const [ticket, setTicket] = useState<TicketResult | null>(null);
  const [dayOffset, setDayOffset] = useState(0);

  useEffect(() => {
    api.get("/sports/events?date=week&limit=200").then((r) => setEvents(r.data.data.events))
      .catch(() => toast.error("Erreur de chargement des matchs"))
      .finally(() => setLoadingEvents(false));
  }, []);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return { offset: i, key: dayKey(d), label: DAY_LABELS[i] };
  });
  const visibleEvents = events.filter((e) => dayKey(new Date(e.startTime)) === days[dayOffset]?.key);

  function toggleOdd(event: Event, market: Market, odd: Odd) {
    const exists = selections.find((s) => s.oddId === odd.id);
    if (exists) {
      setSelections(selections.filter((s) => s.oddId !== odd.id));
      return;
    }
    // Un seul choix par marché à la fois
    const withoutSameMarket = selections.filter((s) => s.marketId !== market.id);
    setSelections([
      ...withoutSameMarket,
      {
        eventId: event.id,
        eventLabel: `${event.homeTeam} vs ${event.awayTeam}`,
        marketId: market.id,
        marketName: market.name,
        oddId: odd.id,
        oddLabel: odd.label,
        oddValue: Number(odd.value),
      },
    ]);
  }

  const totalOdds = selections.reduce((acc, s) => acc * s.oddValue, 1);

  async function placeTicket() {
    if (!selections.length || !stakeXAF) return;
    const stake = parseFloat(stakeXAF);
    if (isNaN(stake) || stake < 100) { toast.error("Mise minimum 100 XAF"); return; }
    if (!confirm(`Confirmer le ticket ?\nMise : ${stake.toLocaleString("fr-FR")} XAF\nGain potentiel : ${(stake * totalOdds).toLocaleString("fr-FR")} XAF`)) return;

    setPlacing(true);
    try {
      const res = await api.post("/tpe/tickets", {
        selections: selections.map((s) => ({ marketId: s.marketId, oddId: s.oddId, oddValue: s.oddValue })),
        stakeXAF: stake,
      });
      setTicket(res.data.data);
      setSelections([]);
      setStakeXAF("");
      toast.success("Ticket créé ! 🎫");
      setTimeout(() => window.print(), 500);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Erreur lors de la création du ticket");
    } finally {
      setPlacing(false);
    }
  }

  if (ticket) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Toaster position="top-center" />
        <div className="bg-white rounded-2xl shadow-sm p-6 no-print">
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-xl font-black text-green-700">Ticket créé !</p>
            <p className="font-mono text-2xl font-black tracking-widest text-gray-800 mt-2">{ticket.code}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => window.print()} className="flex-1 py-3 bg-gray-800 text-white font-bold rounded-xl">
              🖨️ Ré-imprimer
            </button>
            <button onClick={() => setTicket(null)} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl">
              Nouveau ticket
            </button>
          </div>
        </div>

        <div className="print-only">
          <div style={{ fontFamily: "monospace", maxWidth: 320, margin: "0 auto", padding: 16, border: "1px solid #000" }}>
            <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 8 }}>
              <p style={{ fontSize: 20, fontWeight: "bold" }}>SERENITYBET</p>
              <p style={{ fontSize: 12 }}>Ticket de pari sportif</p>
              <p style={{ fontSize: 10, color: "#666" }}>Licence de jeux — République du Tchad</p>
            </div>
            <div style={{ marginBottom: 8 }}>
              <p><strong>Code:</strong> {ticket.code}</p>
              <p><strong>Date:</strong> {new Date(ticket.createdAt).toLocaleString("fr-FR")}</p>
            </div>
            <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "8px 0", marginBottom: 8 }}>
              <p style={{ fontWeight: "bold", marginBottom: 4 }}>SÉLECTIONS ({ticket.items.length})</p>
              {ticket.items.map((it, i) => (
                <div key={i} style={{ marginBottom: 6, fontSize: 11 }}>
                  <p>{i + 1}. {it.market.event.homeTeam} vs {it.market.event.awayTeam}</p>
                  <p style={{ paddingLeft: 12 }}>→ {it.odd.label} @ <strong>{it.oddValue.toFixed(2)}</strong></p>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 8, fontSize: 13 }}>
              <p>Cote totale : <strong>{ticket.totalOdds.toFixed(2)}</strong></p>
              <p>Mise : <strong>{ticket.stakeXAF.toLocaleString("fr-FR")} XAF</strong></p>
              <p style={{ fontSize: 16, fontWeight: "bold" }}>
                Gain potentiel : {ticket.potentialWinXAF.toLocaleString("fr-FR")} XAF
              </p>
            </div>
            <div style={{ textAlign: "center", borderTop: "2px solid #000", paddingTop: 8, fontSize: 10 }}>
              <p>Jouez responsablement. +18 ans uniquement.</p>
              <p>Conservez ce ticket — il est nécessaire pour encaisser tout gain.</p>
              <p style={{ fontFamily: "monospace", fontSize: 14, fontWeight: "bold", marginTop: 4 }}>████ {ticket.code} ████</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 no-print">
      <Toaster position="top-center" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Liste des événements */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-lg font-bold text-gray-800">🆕 Nouveau ticket physique</h2>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {days.map((d) => (
              <button
                key={d.offset}
                onClick={() => setDayOffset(d.offset)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-colors ${
                  dayOffset === d.offset
                    ? "bg-green-600 border-green-600 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-green-400"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {loadingEvents ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400">Chargement des matchs…</div>
          ) : visibleEvents.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400">Aucun match ce jour-là</div>
          ) : (
            visibleEvents.map((event) => (
              <div key={event.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-gray-900 text-sm">{event.homeTeam} vs {event.awayTeam}</p>
                  <span className="text-[11px] text-gray-400">{event.competition.name}</span>
                </div>
                {event.markets.map((market) => (
                  <div key={market.id} className="mb-2">
                    <p className="text-xs text-gray-500 mb-1">{market.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {market.odds.map((odd) => {
                        const selected = selections.some((s) => s.oddId === odd.id);
                        return (
                          <button
                            key={odd.id}
                            disabled={market.isSuspended || !odd.isActive}
                            onClick={() => toggleOdd(event, market, odd)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition-colors disabled:opacity-40 ${
                              selected
                                ? "bg-green-600 border-green-600 text-white"
                                : "bg-gray-50 border-gray-200 text-gray-700 hover:border-green-400"
                            }`}
                          >
                            {odd.label} · {Number(odd.value).toFixed(2)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Coupon en cours */}
        <div className="bg-white rounded-2xl shadow-sm p-4 h-fit sticky top-4">
          <h3 className="font-bold text-gray-800 mb-3">🧾 Sélections ({selections.length})</h3>
          {selections.length === 0 ? (
            <p className="text-sm text-gray-400">Cliquez sur une cote pour l'ajouter</p>
          ) : (
            <div className="space-y-2 mb-4">
              {selections.map((s) => (
                <div key={s.oddId} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{s.eventLabel}</p>
                    <p className="text-[11px] text-gray-500">{s.marketName} — {s.oddLabel} @ {s.oddValue.toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => setSelections(selections.filter((x) => x.oddId !== s.oddId))}
                    className="text-red-400 hover:text-red-600 shrink-0 ml-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {selections.length > 0 && (
            <>
              <div className="mb-3">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mise (XAF)</label>
                <input
                  type="number"
                  value={stakeXAF}
                  onChange={(e) => setStakeXAF(e.target.value)}
                  placeholder="Montant misé"
                  className="w-full px-4 py-3 text-xl font-bold border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
                />
                <div className="flex gap-2 mt-2 flex-wrap">
                  {QUICK_STAKES.map((s) => (
                    <button key={s} onClick={() => setStakeXAF(String(s))}
                      className="px-2.5 py-1 bg-gray-100 hover:bg-green-100 text-gray-700 rounded-lg text-xs font-semibold">
                      {s.toLocaleString("fr-FR")}
                    </button>
                  ))}
                </div>
              </div>

              {stakeXAF && parseFloat(stakeXAF) > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Cote totale :</span>
                    <span className="font-bold">x{totalOdds.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-black text-green-700">
                    <span>Gain potentiel :</span>
                    <span>{(parseFloat(stakeXAF) * totalOdds).toLocaleString("fr-FR")} XAF</span>
                  </div>
                </div>
              )}

              <button
                onClick={placeTicket}
                disabled={placing || !stakeXAF || parseFloat(stakeXAF) <= 0}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl disabled:opacity-50"
              >
                {placing ? "Création…" : "🎫 Créer & Imprimer"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
