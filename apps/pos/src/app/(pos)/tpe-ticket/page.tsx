"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import JsBarcode from "jsbarcode";
import toast, { Toaster } from "react-hot-toast";
import { api } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";

interface Odd { id: string; label: string; value: string; isActive: boolean; }
interface Market { id: string; name: string; type: string; odds: Odd[]; isSuspended: boolean; isActive: boolean; }
interface Event {
  id: string; homeTeam: string; awayTeam: string; startTime: string;
  competition: { name: string };
  markets: Market[];
}

interface Selection {
  eventId: string; eventLabel: string; marketId: string; marketName: string;
  oddId: string; oddLabel: string; oddValue: number; groupKey: string;
}

interface TicketResult {
  code: string;
  stakeXAF: number;
  totalOdds: number;
  potentialWinXAF: number;
  createdAt: string;
  tpe?: { code: string; name: string | null };
  payoutCode?: string;
  items: { oddValue: number; market: { name: string; event: { homeTeam: string; awayTeam: string } }; odd: { label: string } }[];
}

const QUICK_STAKES = [500, 1000, 2000, 5000, 10000, 25000];

function dayKey(d: Date) { return d.toISOString().slice(0, 10); }

const DAY_LABELS = ["Aujourd'hui", "Demain", "J+2", "J+3", "J+4", "J+5", "J+6"];

const LABEL_ORDER: Record<string, string[]> = {
  DOUBLE_CHANCE: ["1X", "12", "X2"],
  BOTH_TEAMS_SCORE: ["Oui", "Non"],
  DRAW_NO_BET: ["1", "2"],
  FIRST_HALF_DOUBLE_CHANCE: ["1X", "12", "X2"],
  SECOND_HALF_DOUBLE_CHANCE: ["1X", "12", "X2"],
};
function sortOddsForDisplay(market: Market): Odd[] {
  const order = LABEL_ORDER[market.type];
  if (!order) return market.odds;
  return [...market.odds].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
}

// Fusionne un marché principal (ligne unique) avec son marché de lignes
// alternatives, en dédoublonnant par libellé (même ligne = même bouton).
function combinedGroupOdds(event: Event, types: string[]): { market: Market; odd: Odd }[] {
  const seenLabels = new Set<string>();
  const result: { market: Market; odd: Odd }[] = [];
  for (const type of types) {
    const market = event.markets.find((m) => m.type === type);
    if (!market) continue;
    for (const odd of market.odds) {
      if (seenLabels.has(odd.label)) continue;
      seenLabels.add(odd.label);
      result.push({ market, odd });
    }
  }
  return result;
}

interface WebCouponSelection {
  eventId: string; eventLabel: string; marketId: string; marketName: string;
  oddId: string; oddLabel: string; oddValue: number;
}

// Même regroupement que combinedGroupOdds : une sélection handicap ou
// plus/moins chargée depuis un coupon web doit porter le même groupKey
// synthétique (${eventId}:HCAP / :TOTALS) que celui utilisé par les boutons
// de lignes fusionnées ci-dessous, sinon cliquer une autre ligne en
// boutique ajoute une deuxième sélection au lieu de remplacer celle du
// coupon (le filtre "même groupe" ne la reconnaîtrait pas).
function inferGroupKey(eventId: string, marketId: string, oddLabel: string): string {
  if (/^[12] \([+-]?[\d.]+\)$/.test(oddLabel)) return `${eventId}:HCAP`;
  if (/^(Plus|Moins) [\d.]+$/.test(oddLabel)) return `${eventId}:TOTALS`;
  return marketId;
}

export default function TpeTicketPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [stakeXAF, setStakeXAF] = useState("");
  const [placing, setPlacing] = useState(false);
  // Code coupon composé par le client sur le site public (serenitybetcode.com)
  // — réutilisable jusqu'à expiration (pas à usage unique), un même code peut
  // donc être chargé plusieurs fois, y compris par des clients différents.
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [loadedWebCouponCode, setLoadedWebCouponCode] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketResult | null>(null);
  const [ticketBarcode, setTicketBarcode] = useState<string | null>(null);
  // Le code de validation ne doit figurer que sur l'impression ORIGINALE —
  // masqué dès que le caissier clique "Ré-imprimer" (voir plus bas), pas sur
  // l'événement navigateur "afterprint" : sur certains appareils Android
  // (selon l'appli d'impression tierce utilisée), cet événement se déclenche
  // avant que l'aperçu/impression ne soit réellement généré, ce qui faisait
  // disparaître le code AVANT qu'il soit imprimé sur l'original lui-même.
  const [codePrinted, setCodePrinted] = useState(false);
  const [dayOffset, setDayOffset] = useState(0);
  const [competitionFilter, setCompetitionFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    api.get("/sports/events?date=week&limit=200").then((r) => setEvents(r.data.data.events))
      .catch(() => toast.error("Erreur de chargement des matchs"))
      .finally(() => setLoadingEvents(false));
  }, []);

  useEffect(() => {
    if (!ticket) { setTicketBarcode(null); return; }
    // Code-barres (CODE128) plutôt qu'un QR carré — une bande fine économise
    // nettement plus de papier thermique sur un rouleau 58mm. On encode le
    // code SANS les tirets (réinsérés au décodage, voir tpe-payout) : à
    // largeur de module égale, moins de modules = barres plus épaisses donc
    // plus fiables à lire par une caméra sur l'espace imprimable réduit.
    try {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, ticket.code.replace(/-/g, ""), {
        format: "CODE128",
        width: 1.3,
        height: 34,
        displayValue: false,
        margin: 0,
      });
      setTicketBarcode(canvas.toDataURL("image/png"));
    } catch {
      setTicketBarcode(null);
    }
  }, [ticket]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return { offset: i, key: dayKey(d), label: DAY_LABELS[i] };
  });
  const competitions = Array.from(new Set(events.map((e) => e.competition.name))).sort((a, b) => a.localeCompare(b));
  const visibleEvents = events
    .filter((e) => dayKey(new Date(e.startTime)) === days[dayOffset]?.key)
    .filter((e) => !competitionFilter || e.competition.name === competitionFilter);

  function toggleOdd(event: Event, market: Market, odd: Odd, marketNameOverride?: string, groupKey?: string) {
    const key = groupKey ?? market.id;
    const exists = selections.find((s) => s.oddId === odd.id);
    if (exists) {
      setSelections(selections.filter((s) => s.oddId !== odd.id));
      return;
    }
    // Un seul pari par match sur un même coupon, quel que soit le marché
    // (pas de "victoire" + "nombre de buts" simultanés sur le même match) —
    // choisir une cote remplace donc toute sélection existante sur ce match,
    // pas seulement celle du même marché/groupe.
    const withoutSameEvent = selections.filter((s) => s.eventId !== event.id);
    setSelections([
      ...withoutSameEvent,
      {
        eventId: event.id,
        eventLabel: `${event.homeTeam} vs ${event.awayTeam}`,
        marketId: market.id,
        marketName: marketNameOverride ?? market.name,
        oddId: odd.id,
        oddLabel: odd.label,
        oddValue: Number(odd.value),
        groupKey: key,
      },
    ]);
  }

  const totalOdds = selections.reduce((acc, s) => acc * s.oddValue, 1);

  // Permet de modifier une sélection (la sienne ou celle d'un coupon
  // chargé) sans tout recomposer : amène directement sur le match déplié,
  // le caissier n'a plus qu'à cliquer une autre cote — utile si le parieur
  // change d'avis en chemin vers la boutique (demander un nouveau code
  // pour un simple changement serait peu pratique pour tout le monde).
  function goToSelection(s: Selection) {
    const event = events.find((e) => e.id === s.eventId);
    if (!event) {
      toast.error("Match introuvable (plus de 7 jours ou déjà commencé)");
      return;
    }
    const idx = days.findIndex((d) => d.key === dayKey(new Date(event.startTime)));
    if (idx >= 0) setDayOffset(idx);
    setCompetitionFilter("");
    setExpandedId(event.id);
    setTimeout(() => {
      document.getElementById(`event-${event.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  async function loadCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setCouponLoading(true);
    try {
      const res = await api.get(`/tpe/web-coupons/${encodeURIComponent(code)}`);
      const data = res.data.data as { code: string; selections: WebCouponSelection[]; droppedCount: number };
      if (data.selections.length === 0) {
        toast.error("Aucune sélection valide dans ce coupon (cotes changées ou matchs déjà commencés)");
        return;
      }
      setSelections(data.selections.map((s) => ({
        ...s, groupKey: inferGroupKey(s.eventId, s.marketId, s.oddLabel),
      })));
      setLoadedWebCouponCode(data.code);
      setCouponCode("");
      if (data.droppedCount > 0) {
        toast.error(`${data.droppedCount} sélection(s) retirée(s) — cote changée ou match déjà commencé`);
      } else {
        toast.success(`Coupon ${data.code} chargé — ${data.selections.length} sélection(s)`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Code coupon introuvable");
    } finally {
      setCouponLoading(false);
    }
  }

  async function placeTicket() {
    if (!selections.length || !stakeXAF) return;
    const stake = parseFloat(stakeXAF);
    if (isNaN(stake) || stake < 100) { toast.error("Mise minimum 100 XAF"); return; }
    const ok = await confirm(`Confirmer le ticket ?\nMise : ${stake.toLocaleString("fr-FR")} XAF\nGain potentiel : ${(stake * totalOdds).toLocaleString("fr-FR")} XAF`);
    if (!ok) return;

    setPlacing(true);
    try {
      const res = await api.post("/tpe/tickets", {
        selections: selections.map((s) => ({ marketId: s.marketId, oddId: s.oddId, oddValue: s.oddValue })),
        stakeXAF: stake,
        webCouponCode: loadedWebCouponCode ?? undefined,
      });
      setTicket(res.data.data);
      setCodePrinted(false);
      setSelections([]);
      setStakeXAF("");
      setLoadedWebCouponCode(null);
      // Pas de toast ici — il reste visible à l'écran pendant l'impression
      // et se superpose à l'aperçu du ticket.
      setTimeout(() => window.print(), 500);
    } catch (err: any) {
      const maxStakeXAF = err.response?.data?.data?.maxStakeXAF;
      if (maxStakeXAF) {
        // Plafond de gain dépassé : on propose directement la mise maximale
        // acceptée pour ce coupon (voir tpe.service.ts placeTicket) — le
        // caissier n'a plus qu'à revalider si ça convient au parieur.
        setStakeXAF(String(maxStakeXAF));
        toast.error(`Gain trop élevé — mise ramenée à ${maxStakeXAF.toLocaleString("fr-FR")} XAF (maximum autorisé). Revalidez si ça convient.`, { duration: 6000 });
      } else {
        toast.error(err.response?.data?.error ?? "Erreur lors de la création du ticket");
      }
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
            <button onClick={() => { setCodePrinted(true); setTimeout(() => window.print(), 50); }} className="flex-1 py-3 bg-gray-800 text-white font-bold rounded-xl">
              🖨️ Ré-imprimer
            </button>
            <button onClick={() => setTicket(null)} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl">
              Nouveau ticket
            </button>
          </div>
        </div>

        <div className="print-only">
          {/* Largeur fixe en mm (pas "100%") : sur certains pilotes
              d'imprimante thermique Windows, le navigateur ne respecte pas
              toujours la taille @page 58mm demandée (voir globals.css) et
              retombe sur une page bien plus large — avec une largeur fluide,
              tout le ticket s'étirait alors sur cette largeur inattendue,
              et un champ aligné à droite (voir ci-dessous) pouvait se
              retrouver poussé hors de la zone imprimable, donc jamais
              réellement imprimé. 48mm = zone imprimable d'un rouleau 58mm,
              tient aussi sans problème sur un rouleau 80mm (juste plus de
              marge à droite). */}
          <div style={{ fontFamily: "monospace", width: "48mm", padding: "4px 6px", fontSize: 12, lineHeight: 1.4, fontWeight: 900 }}>
            <div style={{ textAlign: "center", borderBottom: "1px solid #000", paddingBottom: 4, marginBottom: 4 }}>
              <p style={{ fontSize: 14, fontWeight: "bold" }}>SERENITYBET</p>
              <p style={{ fontSize: 9 }}>Ticket de pari sportif</p>
            </div>
            <div style={{ marginBottom: 4 }}>
              <p><strong>Code:</strong> {ticket.code}</p>
              <p><strong>TPE:</strong> {ticket.tpe?.name ?? ticket.tpe?.code ?? "—"}</p>
              <p><strong>Imprimé le:</strong> {new Date(ticket.createdAt).toLocaleDateString("fr-FR")}</p>
              {ticket.payoutCode && !codePrinted && (
                <p style={{ fontSize: 13 }}><strong>Code de sécurité:</strong> {ticket.payoutCode}</p>
              )}
            </div>
            <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "4px 0", marginBottom: 4 }}>
              <p style={{ fontWeight: "bold", marginBottom: 3 }}>SÉLECTIONS ({ticket.items.length})</p>
              {ticket.items.map((it, i) => (
                <div key={i} style={{ marginBottom: 4, fontSize: 9 }}>
                  <p>{i + 1}. {it.market.event.homeTeam} vs {it.market.event.awayTeam}</p>
                  <p style={{ paddingLeft: 8 }}>→ {it.odd.label} @ <strong>{it.oddValue.toFixed(2)}</strong></p>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 4, fontSize: 10 }}>
              <p>Cote totale : <strong>{ticket.totalOdds.toFixed(2)}</strong></p>
              <p>Mise : <strong>{ticket.stakeXAF.toLocaleString("fr-FR")} XAF</strong></p>
              <p style={{ fontSize: 12, fontWeight: "bold" }}>
                Gain potentiel : {ticket.potentialWinXAF.toLocaleString("fr-FR")} XAF
              </p>
            </div>
            <div style={{ textAlign: "center", borderTop: "1px solid #000", paddingTop: 4, fontSize: 8 }}>
              <p>Jouez responsablement. +18 ans uniquement.</p>
              <p>Conservez ce ticket — il est nécessaire pour encaisser tout gain.</p>
              {ticketBarcode && (
                <img src={ticketBarcode} alt={ticket.code} style={{ maxWidth: "100%", margin: "6px auto 3px", display: "block" }} />
              )}
              <p style={{ fontFamily: "monospace", fontSize: 11, fontWeight: "bold" }}>{ticket.code}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 no-print">
      <Toaster position="top-center" />
      {ConfirmDialog}
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

          <select
            value={competitionFilter}
            onChange={(e) => setCompetitionFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm font-semibold border-2 border-gray-200 bg-white text-gray-700"
          >
            <option value="">🏆 Tous les championnats</option>
            {competitions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {loadingEvents ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400">Chargement des matchs…</div>
          ) : visibleEvents.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400">Aucun match pour ce filtre</div>
          ) : (
            Object.entries(
              visibleEvents.reduce<Record<string, Event[]>>((acc, e) => {
                (acc[e.competition.name] ??= []).push(e);
                return acc;
              }, {}),
            ).map(([compName, evs]) => (
              <div key={compName} className="rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-gray-800 text-white text-xs font-bold px-3 py-2">{compName}</div>
                <div className="divide-y divide-gray-100 bg-white">
                  {evs.map((event) => {
                    const mainMarket = event.markets.find((m) => m.type === "MATCH_WINNER");
                    const mainOdds = mainMarket
                      ? [...mainMarket.odds].sort((a, b) => "1X2".indexOf(a.label) - "1X2".indexOf(b.label))
                      : [];
                    const isExpanded = expandedId === event.id;
                    return (
                      <div key={event.id} id={`event-${event.id}`}>
                        <div className="flex items-center gap-2 p-3">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : event.id)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <p className="font-bold text-gray-900 text-sm truncate">{event.homeTeam} vs {event.awayTeam}</p>
                            <p className="text-[11px] text-gray-400">
                              🕒 {new Date(event.startTime).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </button>
                          <div className="flex gap-1 shrink-0">
                            {mainOdds.length > 0 ? mainOdds.map((odd) => {
                              const selected = selections.some((s) => s.oddId === odd.id);
                              return (
                                <button
                                  key={odd.id}
                                  disabled={mainMarket!.isSuspended || !odd.isActive}
                                  onClick={() => toggleOdd(event, mainMarket!, odd)}
                                  className={`flex flex-col items-center px-3.5 py-2 rounded-lg border-2 transition-colors disabled:opacity-40 min-w-[58px] ${
                                    selected
                                      ? "bg-green-600 border-green-600 text-white"
                                      : "bg-gray-50 border-gray-200 text-gray-700 hover:border-green-400"
                                  }`}
                                >
                                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${selected ? "text-green-100" : "text-gray-400"}`}>
                                    {odd.label}
                                  </span>
                                  <span className="text-base font-black leading-tight">{Number(odd.value).toFixed(2)}</span>
                                </button>
                              );
                            }) : <span className="text-[11px] text-gray-300 px-2">—</span>}
                          </div>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : event.id)}
                            className="text-gray-400 text-xs shrink-0 w-5"
                          >
                            {isExpanded ? "▲" : "▼"}
                          </button>
                        </div>

                        {isExpanded && (() => {
                          // Exclut les libellés historiques ("1"/"2"/"Over"/"Under", sans
                          // point) conservés en base pour l'intégrité des tickets déjà
                          // émis avec l'ancien format — ils ne doivent plus être proposés.
                          const handicapOdds = combinedGroupOdds(event, ["HANDICAP", "ALTERNATE_SPREADS"])
                            .filter((e) => /^[12] \([+-]?[\d.]+\)$/.test(e.odd.label));
                          const totalsOdds = combinedGroupOdds(event, ["OVER_UNDER", "ALTERNATE_TOTALS"])
                            .filter((e) => /^(Plus|Moins) [\d.]+$/.test(e.odd.label));
                          const otherMarkets = event.markets.filter(
                            (m) => !["MATCH_WINNER", "HANDICAP", "ALTERNATE_SPREADS", "OVER_UNDER", "ALTERNATE_TOTALS"].includes(m.type),
                          );
                          const nothing = handicapOdds.length === 0 && totalsOdds.length === 0 && otherMarkets.length === 0;

                          return (
                            <div className="px-3 pb-3 bg-gray-50 space-y-3">
                              {nothing ? (
                                <p className="text-[11px] text-gray-400 pt-1">Pas d'autres marchés disponibles pour ce match.</p>
                              ) : (
                                <>
                                  {handicapOdds.length > 0 && (
                                    <div className="pt-1">
                                      <p className="text-xs text-gray-500 mb-1">Handicap asiatique</p>
                                      <div className="space-y-1.5">
                                        {Object.entries(
                                          handicapOdds.reduce<Record<string, { market: Market; odd: Odd }[]>>((acc, entry) => {
                                            // Clé = point côté équipe 1 (équipe 2 = l'opposé) : deux
                                            // lignes de même ampleur mais de favori opposé (ex. "1 (-1)"
                                            // et "1 (+1)") sont deux lignes distinctes, pas la même.
                                            const m = entry.odd.label.match(/^([12]) \(([+-]?[\d.]+)\)$/)!;
                                            const point = parseFloat(m[2]);
                                            const key = (m[1] === "1" ? point : -point).toFixed(2);
                                            (acc[key] ??= []).push(entry);
                                            return acc;
                                          }, {}),
                                        )
                                          .sort((a, b) => Number(a[0]) - Number(b[0]))
                                          .map(([key, entries]) => {
                                            const niceKey = parseFloat(key);
                                            const line = `${niceKey > 0 ? "+" : ""}${niceKey}`;
                                            return (
                                            <div key={key} className="flex items-center gap-2">
                                              <span className="text-[11px] text-gray-400 w-14 shrink-0">Hcap {line}</span>
                                              <div className="flex-1 grid grid-cols-2 gap-2">
                                                {[...entries]
                                                  .sort((a, b) => a.odd.label.localeCompare(b.odd.label))
                                                  .map(({ market, odd }) => {
                                                    const selected = selections.some((s) => s.oddId === odd.id);
                                                    return (
                                                      <button
                                                        key={odd.id}
                                                        disabled={market.isSuspended || !odd.isActive}
                                                        onClick={() => toggleOdd(event, market, odd, "Handicap asiatique", `${event.id}:HCAP`)}
                                                        className={`flex flex-col items-center w-full py-2.5 rounded-lg border-2 transition-colors disabled:opacity-40 ${
                                                          selected
                                                            ? "bg-green-600 border-green-600 text-white"
                                                            : "bg-white border-gray-200 text-gray-700 hover:border-green-400"
                                                        }`}
                                                      >
                                                        <span className={`text-[10px] font-semibold uppercase tracking-wide ${selected ? "text-green-100" : "text-gray-400"}`}>
                                                          {odd.label}
                                                        </span>
                                                        <span className="text-base font-black leading-tight">{Number(odd.value).toFixed(2)}</span>
                                                      </button>
                                                    );
                                                  })}
                                              </div>
                                            </div>
                                            );
                                          })}
                                      </div>
                                    </div>
                                  )}

                                  {totalsOdds.length > 0 && (
                                    <div className="pt-1">
                                      <p className="text-xs text-gray-500 mb-1">Plus/Moins de buts</p>
                                      <div className="space-y-1.5">
                                        {Object.entries(
                                          totalsOdds.reduce<Record<string, { market: Market; odd: Odd }[]>>((acc, entry) => {
                                            const point = entry.odd.label.split(" ")[1] ?? "?";
                                            (acc[point] ??= []).push(entry);
                                            return acc;
                                          }, {}),
                                        )
                                          .sort((a, b) => Number(a[0]) - Number(b[0]))
                                          .map(([point, entries]) => (
                                            <div key={point} className="flex items-center gap-2">
                                              <span className="text-[11px] text-gray-400 w-14 shrink-0">{point} buts</span>
                                              <div className="flex-1 grid grid-cols-2 gap-2">
                                                {[...entries]
                                                  .sort((a, b) => (a.odd.label.startsWith("Moins") ? -1 : 1) - (b.odd.label.startsWith("Moins") ? -1 : 1))
                                                  .map(({ market, odd }) => {
                                                    const selected = selections.some((s) => s.oddId === odd.id);
                                                    const shortLabel = odd.label.split(" ")[0];
                                                    return (
                                                      <button
                                                        key={odd.id}
                                                        disabled={market.isSuspended || !odd.isActive}
                                                        onClick={() => toggleOdd(event, market, odd, "Plus/Moins de buts", `${event.id}:TOTALS`)}
                                                        className={`flex flex-col items-center w-full py-2.5 rounded-lg border-2 transition-colors disabled:opacity-40 ${
                                                          selected
                                                            ? "bg-green-600 border-green-600 text-white"
                                                            : "bg-white border-gray-200 text-gray-700 hover:border-green-400"
                                                        }`}
                                                      >
                                                        <span className={`text-[10px] font-semibold uppercase tracking-wide ${selected ? "text-green-100" : "text-gray-400"}`}>
                                                          {shortLabel}
                                                        </span>
                                                        <span className="text-base font-black leading-tight">{Number(odd.value).toFixed(2)}</span>
                                                      </button>
                                                    );
                                                  })}
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  )}

                                  {otherMarkets.map((market) => (
                                    <div key={market.id} className="pt-1">
                                      <p className="text-xs text-gray-500 mb-1">{market.name}</p>
                                      {market.type === "TEAM_TOTALS" ? (
                                        <div className="space-y-1.5">
                                          {Object.entries(
                                            market.odds.reduce<Record<string, { team: string; point: string; odds: Odd[] }>>((acc, odd) => {
                                              const m = odd.label.match(/^(.+) (Plus|Moins) ([\d.]+)$/);
                                              const team = m?.[1] ?? "?";
                                              const point = m?.[3] ?? "?";
                                              const key = `${team}|${point}`;
                                              (acc[key] ??= { team, point, odds: [] }).odds.push(odd);
                                              return acc;
                                            }, {}),
                                          )
                                            .sort(([, a], [, b]) => a.team.localeCompare(b.team) || Number(a.point) - Number(b.point))
                                            .map(([key, group]) => (
                                              <div key={key} className="flex items-center gap-2">
                                                <span className="text-[11px] text-gray-400 w-28 shrink-0 truncate">{group.team} {group.point}</span>
                                                <div className="flex-1 grid grid-cols-2 gap-2">
                                                  {[...group.odds]
                                                    .sort((a, b) => (a.label.includes("Moins") ? -1 : 1) - (b.label.includes("Moins") ? -1 : 1))
                                                    .map((odd) => {
                                                      const selected = selections.some((s) => s.oddId === odd.id);
                                                      const shortLabel = odd.label.includes("Moins") ? "Moins" : "Plus";
                                                      return (
                                                        <button
                                                          key={odd.id}
                                                          disabled={market.isSuspended || !odd.isActive}
                                                          onClick={() => toggleOdd(event, market, odd)}
                                                          className={`flex flex-col items-center w-full py-2.5 rounded-lg border-2 transition-colors disabled:opacity-40 ${
                                                            selected
                                                              ? "bg-green-600 border-green-600 text-white"
                                                              : "bg-white border-gray-200 text-gray-700 hover:border-green-400"
                                                          }`}
                                                        >
                                                          <span className={`text-[10px] font-semibold uppercase tracking-wide ${selected ? "text-green-100" : "text-gray-400"}`}>
                                                            {shortLabel}
                                                          </span>
                                                          <span className="text-base font-black leading-tight">{Number(odd.value).toFixed(2)}</span>
                                                        </button>
                                                      );
                                                    })}
                                                </div>
                                              </div>
                                            ))}
                                        </div>
                                      ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                          {sortOddsForDisplay(market).map((odd) => {
                                            const selected = selections.some((s) => s.oddId === odd.id);
                                            return (
                                              <button
                                                key={odd.id}
                                                disabled={market.isSuspended || !odd.isActive}
                                                onClick={() => toggleOdd(event, market, odd)}
                                                className={`flex flex-col items-center w-full py-2.5 rounded-lg border-2 transition-colors disabled:opacity-40 ${
                                                  selected
                                                    ? "bg-green-600 border-green-600 text-white"
                                                    : "bg-white border-gray-200 text-gray-700 hover:border-green-400"
                                                }`}
                                              >
                                                <span className={`text-[10px] font-semibold uppercase tracking-wide ${selected ? "text-green-100" : "text-gray-400"}`}>
                                                  {odd.label}
                                                </span>
                                                <span className="text-base font-black leading-tight">{Number(odd.value).toFixed(2)}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Coupon en cours */}
        <div className="bg-white rounded-2xl shadow-sm p-4 h-fit sticky top-4">
          <div className="mb-4 pb-4 border-b border-gray-100">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Code coupon client (serenitybetcode.com)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadCoupon()}
                placeholder="Ex: 4821"
                className="flex-1 min-w-0 px-3 py-2 text-sm font-mono border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
              />
              <button
                onClick={loadCoupon}
                disabled={couponLoading || !couponCode.trim()}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold rounded-lg disabled:opacity-40 shrink-0"
              >
                {couponLoading ? "…" : "Charger"}
              </button>
            </div>
            {loadedWebCouponCode && (
              <p className="text-[11px] text-green-700 font-semibold mt-1.5">
                ✓ Coupon {loadedWebCouponCode} chargé
              </p>
            )}
          </div>

          <h3 className="font-bold text-gray-800 mb-3">🧾 Sélections ({selections.length})</h3>
          {selections.length === 0 ? (
            <p className="text-sm text-gray-400">Cliquez sur une cote pour l'ajouter</p>
          ) : (
            <div className="space-y-2 mb-4">
              {selections.map((s) => (
                <div key={s.oddId} className="flex items-center justify-between bg-gray-50 hover:bg-green-50 rounded-lg px-3 py-2 cursor-pointer"
                  onClick={() => goToSelection(s)} title="Modifier cette sélection">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{s.eventLabel}</p>
                    <p className="text-[11px] text-gray-500">{s.marketName} — {s.oddLabel} @ {s.oddValue.toFixed(2)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelections(selections.filter((x) => x.oddId !== s.oddId)); }}
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
