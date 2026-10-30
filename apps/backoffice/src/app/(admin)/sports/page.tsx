"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Odd      { id: string; label: string; value: number | string; isActive: boolean }
interface Market   { id: string; name: string; type: string; isActive: boolean; isSuspended: boolean; odds: Odd[]; _count?: { betItems: number } }
interface Event    { id: string; homeTeam: string; awayTeam: string; startTime: string; status: string; homeScore?: number | null; awayScore?: number | null; competition: { name: string; sport: { name: string } }; markets?: Market[]; _count?: { markets: number } }
interface Competition { id: string; name: string; sport: { name: string } }

// ─── Constantes ───────────────────────────────────────────────────────────────

const MARKET_TYPES: { value: string; label: string; defaultOdds: { label: string; value: string }[] }[] = [
  { value: "MATCH_WINNER",      label: "Résultat (1X2)",           defaultOdds: [{ label: "1", value: "1.80" }, { label: "X", value: "3.40" }, { label: "2", value: "4.00" }] },
  { value: "HALF_TIME_RESULT",  label: "Mi-temps (1X2)",           defaultOdds: [{ label: "1", value: "2.10" }, { label: "X", value: "2.60" }, { label: "2", value: "4.50" }] },
  { value: "DOUBLE_CHANCE",     label: "Double chance",            defaultOdds: [{ label: "1X", value: "1.25" }, { label: "12", value: "1.35" }, { label: "X2", value: "1.60" }] },
  { value: "OVER_UNDER",        label: "Plus/Moins de buts",       defaultOdds: [{ label: "Over 2.5", value: "1.90" }, { label: "Under 2.5", value: "1.90" }] },
  { value: "BOTH_TEAMS_SCORE",  label: "Les 2 équipes marquent",   defaultOdds: [{ label: "Oui", value: "1.75" }, { label: "Non", value: "2.00" }] },
  { value: "CORRECT_SCORE",     label: "Score exact",              defaultOdds: [{ label: "1-0", value: "7.00" }, { label: "2-0", value: "8.00" }, { label: "2-1", value: "7.50" }, { label: "0-0", value: "9.00" }, { label: "1-1", value: "5.50" }, { label: "0-1", value: "9.00" }, { label: "0-2", value: "10.00" }, { label: "Autre", value: "5.00" }] },
  { value: "HANDICAP",          label: "Handicap",                 defaultOdds: [{ label: "-1 Dom.", value: "2.20" }, { label: "+1 Ext.", value: "1.70" }] },
  { value: "FIRST_GOAL_SCORER", label: "1er buteur (équipe)",      defaultOdds: [{ label: "Dom. marque 1er", value: "1.85" }, { label: "Ext. marque 1er", value: "2.10" }, { label: "Aucun but", value: "7.00" }] },
  // Marchés calculés automatiquement à partir du seul score final — voir
  // computeItemResult (odds.service.ts). "Domicile"/"Extérieur" dans les
  // libellés par défaut DOIVENT être remplacés par le nom exact de l'équipe
  // (tel qu'affiché sur le match), sinon le règlement auto ne reconnaît pas
  // la sélection et le ticket reste en attente de saisie manuelle.
  { value: "ODD_EVEN_TOTAL",    label: "Total de buts pair/impair", defaultOdds: [{ label: "Pair", value: "1.90" }, { label: "Impair", value: "1.90" }] },
  { value: "CLEAN_SHEET",       label: "Cage inviolée",            defaultOdds: [{ label: "Domicile Oui", value: "2.20" }, { label: "Domicile Non", value: "1.65" }, { label: "Extérieur Oui", value: "3.00" }, { label: "Extérieur Non", value: "1.35" }] },
  { value: "WIN_TO_NIL",        label: "Victoire à zéro",          defaultOdds: [{ label: "Domicile Oui", value: "2.80" }, { label: "Domicile Non", value: "1.42" }, { label: "Extérieur Oui", value: "4.50" }, { label: "Extérieur Non", value: "1.22" }] },
  { value: "WINNING_MARGIN",    label: "Marge de victoire",        defaultOdds: [{ label: "1 (1)", value: "3.50" }, { label: "1 (2)", value: "5.00" }, { label: "1 (3+)", value: "7.00" }, { label: "X", value: "3.40" }, { label: "2 (1)", value: "4.50" }, { label: "2 (2)", value: "7.00" }, { label: "2 (3+)", value: "10.00" }] },
  { value: "TEAM_GOALS",        label: "Buts par équipe (exact)",  defaultOdds: [{ label: "Domicile 0", value: "3.00" }, { label: "Domicile 1", value: "2.50" }, { label: "Domicile 2", value: "3.50" }, { label: "Domicile 3+", value: "4.50" }, { label: "Extérieur 0", value: "2.20" }, { label: "Extérieur 1", value: "3.00" }, { label: "Extérieur 2", value: "4.50" }, { label: "Extérieur 3+", value: "6.00" }] },
  // Marchés réglés via le circuit "stats" existant (saisie manuelle du
  // trader ou automatique via API-Football) — voir stats-settlement.ts.
  { value: "HALF_TIME_CORRECT_SCORE", label: "Score exact à la mi-temps", defaultOdds: [{ label: "0-0", value: "2.20" }, { label: "1-0", value: "3.50" }, { label: "0-1", value: "4.50" }, { label: "1-1", value: "5.00" }, { label: "2-0", value: "7.00" }, { label: "0-2", value: "9.00" }, { label: "2-1", value: "9.00" }, { label: "1-2", value: "11.00" }] },
  { value: "HALF_TIME_FULL_TIME",     label: "Double résultat (mi-temps/fin)", defaultOdds: [{ label: "1/1", value: "2.20" }, { label: "1/X", value: "7.00" }, { label: "1/2", value: "15.00" }, { label: "X/1", value: "4.50" }, { label: "X/X", value: "4.00" }, { label: "X/2", value: "5.50" }, { label: "2/1", value: "17.00" }, { label: "2/X", value: "7.50" }, { label: "2/2", value: "3.20" }] },
  { value: "BOTH_HALVES_SCORE",       label: "Marque dans les 2 mi-temps", defaultOdds: [{ label: "Domicile Oui", value: "2.60" }, { label: "Domicile Non", value: "1.45" }, { label: "Extérieur Oui", value: "3.40" }, { label: "Extérieur Non", value: "1.25" }] },
  { value: "SHOTS_ON_TARGET_TOTAL",   label: "Plus/Moins tirs cadrés",     defaultOdds: [{ label: "Plus 8.5", value: "1.90" }, { label: "Moins 8.5", value: "1.90" }] },
  { value: "FOULS_TOTAL",             label: "Plus/Moins fautes",          defaultOdds: [{ label: "Plus 22.5", value: "1.90" }, { label: "Moins 22.5", value: "1.90" }] },
];

const SPORTS = ["Football", "Basketball", "Tennis", "Rugby", "MMA", "Hockey", "Volleyball", "Handball"];
const DATE_QUICK = [
  { value: "all",   label: "Toutes dates" },
  { value: "today", label: "Aujourd'hui" },
] as const;
// "all" / "today" = raccourcis ; toute autre valeur = une date précise
// (YYYY-MM-DD) choisie via le sélecteur de date, pour naviguer jour par
// jour plutôt que de voir plusieurs jours mélangés en vrac.
type DateRange = "all" | "today" | string;

// Onglets de statut — notamment pour retrouver vite les matchs déjà en
// direct ou déjà terminés (pas couverts par le filtre de date, qui ne porte
// que sur l'heure de coup d'envoi) : nécessaire pour y entrer manuellement
// un résultat que l'API externe n'a pas rapporté.
const STATUS_FILTERS = [
  { value: "",          label: "À venir + en direct" },
  { value: "LIVE",      label: "🔴 En direct" },
  { value: "FINISHED",  label: "✅ Terminés" },
  { value: "CANCELLED", label: "Annulés" },
] as const;

function toYMD(d: Date) {
  // Format local (pas d'UTC) — new Date().toISOString() décale la date
  // autour de minuit selon le fuseau, ce qu'on veut éviter ici.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const STATUS_COLORS: Record<string, string> = {
  UPCOMING: "bo-badge-blue", LIVE: "bo-badge-red", FINISHED: "bo-badge-gray",
  CANCELLED: "bo-badge-gray", POSTPONED: "bo-badge-orange",
};

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("bo_token")}` };
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function SportsPage() {
  const [tab, setTab]                 = useState<"events" | "create">("events");
  const [events, setEvents]           = useState<Event[]>([]);
  const [competitions, setComps]      = useState<Competition[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [filterStatus, setStatus]     = useState("");
  const [dateRange, setDateRange]     = useState<DateRange>("all");
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [selectedEvent, setSelected]  = useState<Event | null>(null);
  const [panelLoading, setPanelLoad]  = useState(false);

  // Création événement
  const [form, setForm] = useState({
    homeTeam: "", awayTeam: "", startTime: "", sport: "Football",
    competitionId: "", competitionName: "",
  });

  // Création marché
  const [newMarket, setNewMarket]    = useState({ type: "MATCH_WINNER", name: "", odds: [] as { label: string; value: string }[] });
  const [addingMarket, setAddMarket] = useState(false);
  const [newOdd, setNewOdd]          = useState({ marketId: "", label: "", value: "" });

  // Réglage en masse des marchés stats (mi-temps, corners, cartons, tirs, fautes)
  const [statsForm, setStatsForm] = useState({
    homeScore: "", awayScore: "", htHome: "", htAway: "",
    cornersHome: "", cornersAway: "", cardsHome: "", cardsAway: "",
    shotsHome: "", shotsAway: "", foulsHome: "", foulsAway: "",
  });
  const [settlingStats, setSettlingStats] = useState(false);

  const up = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  // Calcul marge bookmaker
  const h2hMarket = newMarket.type === "MATCH_WINNER" || newMarket.type === "HALF_TIME_RESULT";
  const margin = newMarket.odds.length >= 2
    ? ((newMarket.odds.reduce((acc, o) => acc + (parseFloat(o.value) > 1 ? 1 / parseFloat(o.value) : 0), 0) - 1) * 100).toFixed(1)
    : null;

  // ── Chargement données ───────────────────────────────────────────────────────

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", page: String(page) });
      if (search)       params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      if (dateRange === "today") {
        const today = toYMD(new Date());
        params.set("from", today); params.set("to", today);
      } else if (dateRange !== "all") {
        // Une date précise (YYYY-MM-DD) choisie via le sélecteur.
        params.set("from", dateRange); params.set("to", dateRange);
      }
      const r = await fetch(`${API}/admin/sports/events?${params}`, { headers: authHeaders() });
      const d = await r.json();
      if (d.data?.events) {
        setEvents(d.data.events);
        setTotalPages(d.data.totalPages ?? 1);
        setTotalEvents(d.data.total ?? d.data.events.length);
      }
    } finally { setLoading(false); }
  }, [search, filterStatus, dateRange, page]);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  // Revenir à la page 1 dès qu'un filtre change, sinon on peut se retrouver
  // sur une page qui n'existe plus pour le nouveau filtre (liste vide).
  useEffect(() => { setPage(1); }, [search, filterStatus, dateRange]);

  useEffect(() => {
    fetch(`${API}/admin/sports/competitions`, { headers: authHeaders() })
      .then(r => r.json()).then(d => { if (d.data) setComps(d.data); });
  }, []);

  // ── Ouvrir panel marché ───────────────────────────────────────────────────────

  async function openPanel(event: Event) {
    setPanelLoad(true);
    setSelected({ ...event, markets: undefined });
    try {
      const r = await fetch(`${API}/admin/sports/events/${event.id}`, { headers: authHeaders() });
      const d = await r.json();
      if (d.data) {
        setSelected(d.data);
        setStatsForm({
          homeScore: d.data.homeScore != null ? String(d.data.homeScore) : "",
          awayScore: d.data.awayScore != null ? String(d.data.awayScore) : "",
          htHome: "", htAway: "", cornersHome: "", cornersAway: "", cardsHome: "", cardsAway: "",
          shotsHome: "", shotsAway: "", foulsHome: "", foulsAway: "",
        });
      }
    } finally { setPanelLoad(false); }
  }

  // ── Créer événement ───────────────────────────────────────────────────────────

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!form.homeTeam || !form.awayTeam || !form.startTime) {
      toast.error("Remplis tous les champs obligatoires"); return;
    }
    try {
      const payload: any = {
        homeTeam: form.homeTeam, awayTeam: form.awayTeam,
        startTime: form.startTime, sportName: form.sport,
      };
      if (form.competitionId)   payload.competitionId   = form.competitionId;
      else if (form.competitionName) payload.competitionName = form.competitionName;
      else { toast.error("Sélectionne ou entre une compétition"); return; }

      const r = await fetch(`${API}/admin/sports/events`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success("✓ Match créé !");
      setForm({ homeTeam: "", awayTeam: "", startTime: "", sport: "Football", competitionId: "", competitionName: "" });
      loadEvents();
      setTab("events");
    } catch { toast.error("Erreur réseau"); }
  }

  // ── Ajouter un marché ─────────────────────────────────────────────────────────

  async function addMarket() {
    if (!selectedEvent || !newMarket.name || !newMarket.type) {
      toast.error("Nom et type requis"); return;
    }
    if (newMarket.odds.length < 2) { toast.error("Minimum 2 cotes requises"); return; }
    setAddMarket(true);
    try {
      const r = await fetch(`${API}/admin/sports/events/${selectedEvent.id}/markets`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ name: newMarket.name, type: newMarket.type, odds: newMarket.odds.map(o => ({ label: o.label, value: parseFloat(o.value) })) }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success("✓ Marché créé !");
      // rafraîchir le panel
      await openPanel(selectedEvent);
      setNewMarket({ type: "MATCH_WINNER", name: "", odds: [] });
    } finally { setAddMarket(false); }
  }

  // ── Supprimer marché ──────────────────────────────────────────────────────────

  async function deleteMarket(marketId: string) {
    if (!confirm("Supprimer ce marché ?")) return;
    const r = await fetch(`${API}/admin/sports/markets/${marketId}`, { method: "DELETE", headers: authHeaders() });
    const d = await r.json();
    if (!r.ok) { toast.error(d.error ?? "Erreur"); return; }
    toast.success("Marché supprimé");
    if (selectedEvent) await openPanel(selectedEvent);
  }

  // ── Suspendre/activer marché ──────────────────────────────────────────────────

  async function toggleMarket(market: Market) {
    await fetch(`${API}/admin/sports/markets/${market.id}`, {
      method: "PATCH", headers: authHeaders(),
      body: JSON.stringify({ isSuspended: !market.isSuspended }),
    });
    toast.success(market.isSuspended ? "Marché activé" : "Marché suspendu");
    if (selectedEvent) await openPanel(selectedEvent);
  }

  // ── Modifier cote ─────────────────────────────────────────────────────────────

  async function updateOdd(oddId: string, value: string) {
    const r = await fetch(`${API}/admin/sports/odds/${oddId}`, {
      method: "PATCH", headers: authHeaders(),
      body: JSON.stringify({ value: parseFloat(value) }),
    });
    if (r.ok) toast.success("Cote mise à jour ✓");
    else toast.error("Valeur invalide");
  }

  // ── Ajouter cote à un marché ─────────────────────────────────────────────────

  async function addOdd() {
    if (!newOdd.marketId || !newOdd.label || !newOdd.value) {
      toast.error("Remplis tous les champs"); return;
    }
    const r = await fetch(`${API}/admin/sports/markets/${newOdd.marketId}/odds`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ label: newOdd.label, value: parseFloat(newOdd.value) }),
    });
    const d = await r.json();
    if (!r.ok) { toast.error(d.error ?? "Erreur"); return; }
    toast.success("✓ Cote ajoutée");
    setNewOdd({ marketId: "", label: "", value: "" });
    if (selectedEvent) await openPanel(selectedEvent);
  }

  // ── Supprimer cote ────────────────────────────────────────────────────────────

  async function deleteOdd(oddId: string) {
    await fetch(`${API}/admin/sports/odds/${oddId}`, { method: "DELETE", headers: authHeaders() });
    toast.success("Cote supprimée");
    if (selectedEvent) await openPanel(selectedEvent);
  }

  // ── Réglage en masse des marchés stats ────────────────────────────────────────

  async function settleStats() {
    if (!selectedEvent) return;
    const body: Record<string, number> = {};
    if (statsForm.homeScore !== "" && statsForm.awayScore !== "") {
      body.homeScore = Number(statsForm.homeScore); body.awayScore = Number(statsForm.awayScore);
    }
    if (statsForm.htHome !== "" && statsForm.htAway !== "") {
      body.htHomeScore = Number(statsForm.htHome); body.htAwayScore = Number(statsForm.htAway);
    }
    if (statsForm.cornersHome !== "" && statsForm.cornersAway !== "") {
      body.cornersHome = Number(statsForm.cornersHome); body.cornersAway = Number(statsForm.cornersAway);
    }
    if (statsForm.cardsHome !== "" && statsForm.cardsAway !== "") {
      body.cardsHome = Number(statsForm.cardsHome); body.cardsAway = Number(statsForm.cardsAway);
    }
    if (statsForm.shotsHome !== "" && statsForm.shotsAway !== "") {
      body.shotsHome = Number(statsForm.shotsHome); body.shotsAway = Number(statsForm.shotsAway);
    }
    if (statsForm.foulsHome !== "" && statsForm.foulsAway !== "") {
      body.foulsHome = Number(statsForm.foulsHome); body.foulsAway = Number(statsForm.foulsAway);
    }
    setSettlingStats(true);
    try {
      const r = await fetch(`${API}/admin/sports/events/${selectedEvent.id}/settle-stats`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success(`✓ ${d.data.updatedItems} sélection(s) réglée(s) — ${d.data.settledTickets} ticket(s) soldé(s)`);
      await openPanel(selectedEvent);
    } catch { toast.error("Erreur réseau"); }
    finally { setSettlingStats(false); }
  }

  // ── Changer type marché → pré-remplir cotes ───────────────────────────────────

  function onMarketTypeChange(type: string) {
    const mt = MARKET_TYPES.find(m => m.value === type);
    setNewMarket({ type, name: mt?.label ?? "", odds: mt?.defaultOdds ? [...mt.defaultOdds] : [] });
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-4 h-full">
      {/* Colonne principale */}
      <div className={`flex-1 space-y-4 transition-all ${selectedEvent ? "max-w-[calc(100%-420px)]" : ""}`}>

        {/* Onglets */}
        <div className="flex gap-2">
          {(["events", "create"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? "bg-green-600 text-white" : "bg-bo-card text-t-muted hover:text-t-primary border border-bo-border2"}`}>
              {t === "events" ? "📋 Matchs" : "➕ Créer un match"}
            </button>
          ))}
        </div>

        {/* ── Onglet Matchs ── */}
        {tab === "events" && (
          <>
            {/* Filtres */}
            <div className="bo-filter-bar">
              <input className="bo-input flex-1" placeholder="🔍 Rechercher un match…"
                value={search} onChange={e => setSearch(e.target.value)} />
              <button onClick={loadEvents} className="bo-btn-secondary text-xs">↺ Actualiser</button>
            </div>

            {/* Statut — onglets dédiés pour retrouver vite les matchs déjà en
                direct ou terminés, et y entrer manuellement un résultat que
                l'API externe n'a pas rapporté. */}
            <div className="flex gap-2">
              {STATUS_FILTERS.map(s => (
                <button key={s.value} onClick={() => {
                  setStatus(s.value);
                  // "Terminés" sans filtre de date affichait tout l'historique
                  // mélangé (comme "Tous" le faisait pour les matchs à
                  // venir) — on recadre par défaut sur aujourd'hui, les
                  // raccourcis/sélecteur de date restant disponibles pour
                  // naviguer jour par jour.
                  if (s.value === "FINISHED" && dateRange === "all") setDateRange("today");
                }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterStatus === s.value ? "bg-green-600 text-white" : "bg-bo-card text-t-muted hover:text-t-primary border border-bo-border2"}`}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Période — sans ça, avec beaucoup de compétitions synchronisées,
                les 50 matchs du jour seul remplissent déjà toute la page et
                masquent ceux des jours suivants. Le sélecteur de date permet
                de naviguer jour par jour plutôt que de voir plusieurs jours
                mélangés en vrac. */}
            <div className="flex items-center gap-2 flex-wrap">
              {DATE_QUICK.map(r => (
                <button key={r.value} onClick={() => setDateRange(r.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dateRange === r.value ? "bg-green-600 text-white" : "bg-bo-card text-t-muted hover:text-t-primary border border-bo-border2"}`}>
                  {r.label}
                </button>
              ))}
              <input type="date" className="bo-input text-xs py-1.5"
                value={dateRange !== "all" && dateRange !== "today" ? dateRange : ""}
                onChange={e => {
                  // Le champ natif peut émettre un événement avec une valeur
                  // vide pendant la saisie (avant qu'une date complète soit
                  // entrée) — ignorer ces états intermédiaires au lieu de
                  // réinitialiser silencieusement sur "Toutes dates"
                  // (bug signalé en prod le 30/10/2026 : choisir une date
                  // affichait quand même tous les matchs, sans filtre).
                  if (e.target.value) setDateRange(e.target.value);
                }} />
            </div>

            <div className="bo-card">
              <div className="bo-card-header">
                <span className="bo-card-title">📋 Matchs ({totalEvents})</span>
              </div>
              {loading ? (
                <div className="p-8 text-center text-t-faint">Chargement…</div>
              ) : events.length === 0 ? (
                <div className="p-8 text-center text-t-faint">
                  <p className="text-4xl mb-2">🏟️</p>
                  <p>Aucun match trouvé</p>
                  <button onClick={() => setTab("create")} className="bo-btn-primary mt-3 text-sm">
                    ➕ Créer un match
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-bo-border">
                  {events.map(event => (
                    <div key={event.id} className={`p-3 flex items-center gap-3 hover:bg-bo-surface transition-colors ${selectedEvent?.id === event.id ? "bg-green-600/5 border-l-2 border-green-500" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-t-primary text-sm truncate">
                            {event.homeTeam} <span className="text-t-faint font-normal">vs</span> {event.awayTeam}
                          </span>
                          <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${STATUS_COLORS[event.status] ?? "bo-badge-gray"}`}>
                            {event.status === "LIVE" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mr-0.5" />}
                            {event.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-t-faint">
                          <span>{event.competition?.sport?.name} · {event.competition?.name}</span>
                          <span>{new Date(event.startTime).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                          <span className="text-green-400 font-medium">{event._count?.markets ?? 0} marché(s)</span>
                        </div>
                      </div>
                      <button onClick={() => openPanel(event)}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedEvent?.id === event.id ? "bg-green-600 text-white" : "bg-bo-input border border-bo-border2 text-t-secondary hover:border-green-500 hover:text-green-400"}`}>
                        🎯 Marchés
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-3 py-2.5 border-t border-bo-border text-xs text-t-faint">
                  <span>Page {page} / {totalPages}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                      className="bo-btn-secondary text-xs disabled:opacity-40 disabled:cursor-not-allowed">← Précédent</button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                      className="bo-btn-secondary text-xs disabled:opacity-40 disabled:cursor-not-allowed">Suivant →</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Onglet Créer match ── */}
        {tab === "create" && (
          <div className="bo-card">
            <div className="bo-card-header">
              <span className="bo-card-title">➕ Nouveau match</span>
            </div>
            <div className="bo-card-body">
              <form onSubmit={createEvent} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Équipe domicile *</label>
                    <input className="bo-input w-full" placeholder="ex: Al-Hilal Ndjamena" value={form.homeTeam} onChange={up("homeTeam")} required />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Équipe extérieur *</label>
                    <input className="bo-input w-full" placeholder="ex: Tourbillon FC" value={form.awayTeam} onChange={up("awayTeam")} required />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Date et heure *</label>
                    <input type="datetime-local" className="bo-input w-full" value={form.startTime} onChange={up("startTime")} required />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Sport</label>
                    <select className="bo-select w-full" value={form.sport} onChange={up("sport")}>
                      {SPORTS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Compétition existante</label>
                    <select className="bo-select w-full" value={form.competitionId}
                      onChange={e => setForm(p => ({ ...p, competitionId: e.target.value, competitionName: "" }))}>
                      <option value="">— Nouvelle compétition —</option>
                      {competitions.map(c => <option key={c.id} value={c.id}>{c.sport.name} · {c.name}</option>)}
                    </select>
                  </div>
                  {!form.competitionId && (
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Nom de la compétition *</label>
                      <input className="bo-input w-full" placeholder="ex: Championnat National Tchad"
                        value={form.competitionName}
                        onChange={e => setForm(p => ({ ...p, competitionName: e.target.value }))} />
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" className="bo-btn-secondary"
                    onClick={() => setForm({ homeTeam: "", awayTeam: "", startTime: "", sport: "Football", competitionId: "", competitionName: "" })}>
                    ↺ Réinitialiser
                  </button>
                  <button type="submit" className="bo-btn-primary">✓ Créer le match</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ── Panel droit : Gestion marchés ── */}
      {selectedEvent && (
        // sticky top-6 : le panneau doit rester visible à l'écran quelle que
        // soit la position de défilement dans la (longue) liste des matchs à
        // gauche — sans ça, cliquer sur "Marchés" pour un match situé plus
        // bas ouvre le panneau hors champ, en haut du conteneur, invisible
        // sans remonter manuellement (signalé en prod le 30/10/2026).
        // top-6 correspond au padding-top (p-6) du <main> parent.
        <div className="w-[410px] shrink-0 space-y-3 overflow-y-auto max-h-[calc(100vh-120px)] pr-1 sticky top-6 self-start">
          {/* Header panel */}
          <div className="bo-card sticky top-0 z-10">
            <div className="bo-card-body py-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-t-primary text-sm">{selectedEvent.homeTeam} vs {selectedEvent.awayTeam}</p>
                  <p className="text-[11px] text-t-faint">{selectedEvent.competition?.name} · {new Date(selectedEvent.startTime).toLocaleString("fr-FR")}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-t-faint hover:text-t-primary text-lg leading-none">✕</button>
              </div>
            </div>
          </div>

          {panelLoading ? (
            <div className="bo-card p-8 text-center text-t-faint">Chargement des marchés…</div>
          ) : (
            <>
              {/* ── Réglage en masse (mi-temps, corners, cartons) ── */}
              <div className="bo-card border-dashed border-orange-500/30">
                <div className="bo-card-header">
                  <span className="bo-card-title text-sm">🧮 Clôturer le match / régler les tickets</span>
                </div>
                <div className="bo-card-body space-y-2.5">
                  <p className="text-[11px] text-t-faint -mt-1">
                    Entre les données connues une seule fois — ça règle automatiquement toutes les
                    sélections concernées, sur tous les tickets liés à ce match. Le score final seul
                    suffit à clôturer le match et régler son marché principal (ex. vainqueur) même si
                    TheOddsAPI ne l'a jamais rapporté comme terminé — mi-temps/corners/cartons sont
                    facultatifs et ne servent qu'à régler ces marchés spécifiques en plus.
                  </p>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1">Score final</label>
                    <div className="flex items-center gap-1.5">
                      <input className="bo-input w-16 text-xs py-1 font-mono text-center" type="number" min="0" placeholder="Dom."
                        value={statsForm.homeScore} onChange={e => setStatsForm(p => ({ ...p, homeScore: e.target.value }))} />
                      <span className="text-t-faint text-xs">–</span>
                      <input className="bo-input w-16 text-xs py-1 font-mono text-center" type="number" min="0" placeholder="Ext."
                        value={statsForm.awayScore} onChange={e => setStatsForm(p => ({ ...p, awayScore: e.target.value }))} />
                      {selectedEvent.homeScore != null && <span className="text-[10px] text-green-400 ml-1">déjà connu ✓</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1">Score à la mi-temps</label>
                    <div className="flex items-center gap-1.5">
                      <input className="bo-input w-16 text-xs py-1 font-mono text-center" type="number" min="0" placeholder="Dom."
                        value={statsForm.htHome} onChange={e => setStatsForm(p => ({ ...p, htHome: e.target.value }))} />
                      <span className="text-t-faint text-xs">–</span>
                      <input className="bo-input w-16 text-xs py-1 font-mono text-center" type="number" min="0" placeholder="Ext."
                        value={statsForm.htAway} onChange={e => setStatsForm(p => ({ ...p, htAway: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1">Corners</label>
                      <div className="flex items-center gap-1.5">
                        <input className="bo-input w-14 text-xs py-1 font-mono text-center" type="number" min="0" placeholder="Dom."
                          value={statsForm.cornersHome} onChange={e => setStatsForm(p => ({ ...p, cornersHome: e.target.value }))} />
                        <span className="text-t-faint text-xs">–</span>
                        <input className="bo-input w-14 text-xs py-1 font-mono text-center" type="number" min="0" placeholder="Ext."
                          value={statsForm.cornersAway} onChange={e => setStatsForm(p => ({ ...p, cornersAway: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1">Cartons</label>
                      <div className="flex items-center gap-1.5">
                        <input className="bo-input w-14 text-xs py-1 font-mono text-center" type="number" min="0" placeholder="Dom."
                          value={statsForm.cardsHome} onChange={e => setStatsForm(p => ({ ...p, cardsHome: e.target.value }))} />
                        <span className="text-t-faint text-xs">–</span>
                        <input className="bo-input w-14 text-xs py-1 font-mono text-center" type="number" min="0" placeholder="Ext."
                          value={statsForm.cardsAway} onChange={e => setStatsForm(p => ({ ...p, cardsAway: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1">Tirs cadrés</label>
                      <div className="flex items-center gap-1.5">
                        <input className="bo-input w-14 text-xs py-1 font-mono text-center" type="number" min="0" placeholder="Dom."
                          value={statsForm.shotsHome} onChange={e => setStatsForm(p => ({ ...p, shotsHome: e.target.value }))} />
                        <span className="text-t-faint text-xs">–</span>
                        <input className="bo-input w-14 text-xs py-1 font-mono text-center" type="number" min="0" placeholder="Ext."
                          value={statsForm.shotsAway} onChange={e => setStatsForm(p => ({ ...p, shotsAway: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1">Fautes</label>
                      <div className="flex items-center gap-1.5">
                        <input className="bo-input w-14 text-xs py-1 font-mono text-center" type="number" min="0" placeholder="Dom."
                          value={statsForm.foulsHome} onChange={e => setStatsForm(p => ({ ...p, foulsHome: e.target.value }))} />
                        <span className="text-t-faint text-xs">–</span>
                        <input className="bo-input w-14 text-xs py-1 font-mono text-center" type="number" min="0" placeholder="Ext."
                          value={statsForm.foulsAway} onChange={e => setStatsForm(p => ({ ...p, foulsAway: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <button onClick={settleStats} disabled={settlingStats}
                    className="bo-btn-primary w-full text-sm disabled:opacity-50">
                    {settlingStats ? "Règlement…" : "⚡ Régler les tickets concernés"}
                  </button>
                </div>
              </div>

              {/* ── Marchés existants ── */}
              {selectedEvent.markets && selectedEvent.markets.length > 0 ? (
                <div className="space-y-2">
                  {selectedEvent.markets.map(market => (
                    <div key={market.id} className="bo-card">
                      <div className="bo-card-body py-2.5">
                        {/* En-tête marché */}
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-semibold text-t-primary text-sm">{market.name}</span>
                            <span className="ml-2 text-[9px] uppercase bg-bo-input text-t-faint px-1.5 py-0.5 rounded">
                              {MARKET_TYPES.find(m => m.value === market.type)?.label ?? market.type}
                            </span>
                            {market._count?.betItems ? (
                              <span className="ml-1 text-[9px] text-orange-400">{market._count.betItems} paris</span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => toggleMarket(market)}
                              className={`text-[9px] px-2 py-0.5 rounded font-bold border transition-all ${market.isSuspended ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20"}`}>
                              {market.isSuspended ? "⏸ SUSPENDU" : "▶ ACTIF"}
                            </button>
                            {(!market._count?.betItems) && (
                              <button onClick={() => deleteMarket(market.id)}
                                className="text-[10px] text-red-400 hover:text-red-300 px-1">🗑</button>
                            )}
                          </div>
                        </div>

                        {/* Cotes */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {market.odds.map(odd => (
                            <OddEditor key={odd.id} odd={odd}
                              onSave={(v) => updateOdd(odd.id, v)}
                              onDelete={() => deleteOdd(odd.id)} />
                          ))}
                        </div>

                        {/* Ajouter une cote */}
                        {newOdd.marketId === market.id ? (
                          <div className="flex gap-1.5 mt-1">
                            <input className="bo-input flex-1 text-xs py-1" placeholder="Label (ex: 1-1)"
                              value={newOdd.label} onChange={e => setNewOdd(p => ({ ...p, label: e.target.value }))} />
                            <input className="bo-input w-20 text-xs py-1 font-mono" placeholder="2.50" type="number" step="0.01"
                              value={newOdd.value} onChange={e => setNewOdd(p => ({ ...p, value: e.target.value }))} />
                            <button onClick={addOdd} className="bo-btn-primary text-xs py-1 px-2">✓</button>
                            <button onClick={() => setNewOdd({ marketId: "", label: "", value: "" })} className="bo-btn-secondary text-xs py-1 px-2">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setNewOdd({ marketId: market.id, label: "", value: "" })}
                            className="text-[11px] text-green-400 hover:text-green-300 transition-colors">
                            + Ajouter une cote
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bo-card p-5 text-center text-t-faint text-sm">
                  <p className="text-2xl mb-1">🎯</p>
                  <p>Aucun marché pour ce match</p>
                  <p className="text-[11px] mt-1">Crée le premier marché ci-dessous</p>
                </div>
              )}

              {/* ── Créer nouveau marché ── */}
              <div className="bo-card border-dashed border-green-500/30">
                <div className="bo-card-header">
                  <span className="bo-card-title text-sm">➕ Ajouter un marché</span>
                </div>
                <div className="bo-card-body space-y-3">
                  {/* Type de marché */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1">Type</label>
                    <select className="bo-select w-full text-sm" value={newMarket.type}
                      onChange={e => onMarketTypeChange(e.target.value)}>
                      {MARKET_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>

                  {/* Nom du marché */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1">Nom affiché</label>
                    <input className="bo-input w-full text-sm" placeholder="ex: Mi-temps — Résultat"
                      value={newMarket.name} onChange={e => setNewMarket(p => ({ ...p, name: e.target.value }))} />
                  </div>

                  {/* Cotes */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] uppercase tracking-widest text-t-faint">Cotes</label>
                      {margin !== null && (
                        <span className={`text-[11px] font-mono ${parseFloat(margin) > 0 ? "text-green-400" : "text-red-400"}`}>
                          Marge: {margin}% {parseFloat(margin) > 0 ? "✓" : "⚠"}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {newMarket.odds.map((odd, i) => (
                        <div key={i} className="flex gap-1.5 items-center">
                          <input className="bo-input flex-1 text-xs py-1" placeholder="Label"
                            value={odd.label} onChange={e => {
                              const odds = [...newMarket.odds];
                              odds[i] = { ...odds[i], label: e.target.value };
                              setNewMarket(p => ({ ...p, odds }));
                            }} />
                          <input className="bo-input w-20 text-xs py-1 font-mono" type="number" step="0.01" min="1.01"
                            value={odd.value} onChange={e => {
                              const odds = [...newMarket.odds];
                              odds[i] = { ...odds[i], value: e.target.value };
                              setNewMarket(p => ({ ...p, odds }));
                            }} />
                          <button onClick={() => setNewMarket(p => ({ ...p, odds: p.odds.filter((_, j) => j !== i) }))}
                            className="text-red-400 text-xs hover:text-red-300">✕</button>
                        </div>
                      ))}
                      <button onClick={() => setNewMarket(p => ({ ...p, odds: [...p.odds, { label: "", value: "2.00" }] }))}
                        className="text-[11px] text-green-400 hover:text-green-300">+ Ajouter ligne</button>
                    </div>
                  </div>

                  <button onClick={addMarket} disabled={addingMarket}
                    className="bo-btn-primary w-full text-sm disabled:opacity-50">
                    {addingMarket ? "Création…" : "✓ Créer ce marché"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sous-composant : éditeur de cote ────────────────────────────────────────

function OddEditor({ odd, onSave, onDelete }: { odd: Odd; onSave: (v: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(Number(odd.value).toFixed(2));

  function save() {
    if (!isNaN(parseFloat(val)) && parseFloat(val) >= 1.01) {
      onSave(val); setEditing(false);
    } else { toast.error("Cote invalide (min 1.01)"); }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-t-faint">{odd.label}</span>
        <input type="number" step="0.01" className="bo-input w-16 text-xs py-0.5 font-mono"
          value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          autoFocus />
        <button onClick={save} className="text-green-400 text-xs">✓</button>
        <button onClick={() => setEditing(false)} className="text-t-faint text-xs">✕</button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-0.5">
      <button onClick={() => setEditing(true)}
        className="bg-bo-input border border-bo-border2 rounded px-2 py-0.5 text-[11px] font-mono transition-colors hover:border-green-500 group-hover:border-green-400">
        <span className="text-t-faint text-[9px]">{odd.label}</span>
        <span className="text-green-400 font-bold ml-1">{Number(odd.value).toFixed(2)}</span>
      </button>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-red-400 text-[9px] hover:text-red-300 transition-opacity px-0.5">
        ✕
      </button>
    </div>
  );
}
