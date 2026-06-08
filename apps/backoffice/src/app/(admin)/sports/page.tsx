"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Odd      { id: string; label: string; value: number | string; isActive: boolean }
interface Market   { id: string; name: string; type: string; isActive: boolean; isSuspended: boolean; odds: Odd[]; _count?: { betItems: number } }
interface Event    { id: string; homeTeam: string; awayTeam: string; startTime: string; status: string; competition: { name: string; sport: { name: string } }; markets?: Market[]; _count?: { markets: number } }
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
];

const SPORTS = ["Football", "Basketball", "Tennis", "Rugby", "MMA", "Hockey", "Volleyball", "Handball"];
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
      const params = new URLSearchParams({ limit: "50" });
      if (search)       params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      const r = await fetch(`${API}/admin/sports/events?${params}`, { headers: authHeaders() });
      const d = await r.json();
      if (d.data?.events) setEvents(d.data.events);
    } finally { setLoading(false); }
  }, [search, filterStatus]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

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
      if (d.data) setSelected(d.data);
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
              <select className="bo-select" value={filterStatus} onChange={e => setStatus(e.target.value)}>
                <option value="">Tous les statuts</option>
                {["UPCOMING", "LIVE", "FINISHED", "CANCELLED"].map(s => <option key={s}>{s}</option>)}
              </select>
              <button onClick={loadEvents} className="bo-btn-secondary text-xs">↺ Actualiser</button>
            </div>

            <div className="bo-card">
              <div className="bo-card-header">
                <span className="bo-card-title">📋 Matchs ({events.length})</span>
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
        <div className="w-[410px] shrink-0 space-y-3 overflow-y-auto max-h-[calc(100vh-120px)] pr-1">
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
