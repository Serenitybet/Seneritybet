"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

const DEMO_MATCHES = [
  { id: "1", t1: "Real Madrid",  t2: "Bayern Munich", comp: "Ligue des Champions", date: "27/05 · 20:45", o1: "2.15", oX: "3.35", o2: "2.80", status: "live", margin: "10.2" },
  { id: "2", t1: "PSG",          t2: "Arsenal",       comp: "Ligue des Champions", date: "27/05 · 21:00", o1: "1.72", oX: "3.55", o2: "4.30", status: "prog", margin: "9.8" },
  { id: "3", t1: "Cameroun",     t2: "Nigeria",       comp: "CAN 2026",            date: "28/05 · 19:00", o1: "2.40", oX: "3.10", o2: "2.70", status: "prog", margin: "10.0" },
  { id: "4", t1: "Man City",     t2: "Liverpool",     comp: "Premier League",      date: "27/05 · 19:30", o1: "2.10", oX: "3.45", o2: "3.20", status: "live", margin: "10.5" },
  { id: "5", t1: "FC Barcelone", t2: "Séville FC",    comp: "La Liga",             date: "27/05 · 20:00", o1: "1.45", oX: "4.20", o2: "6.50", status: "prog", margin: "11.2" },
  { id: "6", t1: "Chelsea",      t2: "Tottenham",     comp: "Premier League",      date: "27/05 · 17:30", o1: "1.95", oX: "3.60", o2: "3.80", status: "fin",  margin: "9.4" },
];

function statusBadge(s: string) {
  if (s === "live") return <span className="bo-badge-red"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block mr-0.5" />En direct</span>;
  if (s === "prog") return <span className="bo-badge-blue">Programmé</span>;
  return <span className="bo-badge-gray">Terminé</span>;
}

export default function SportsPage() {
  const [apiEvents, setApiEvents] = useState<any[]>([]);
  const [editOdd, setEditOdd] = useState<{ id: string; value: string } | null>(null);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    t1: "", t2: "", comp: "", date: "", sport: "Football", status: "Programmé",
    o1: "1.80", oX: "3.40", o2: "4.00",
  });

  const up = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [f]: e.target.value }));

  const margin = (() => {
    const o1 = parseFloat(form.o1) || 1;
    const oX = parseFloat(form.oX) || 1;
    const o2 = parseFloat(form.o2) || 1;
    return ((1 / o1 + 1 / oX + 1 / o2 - 1) * 100).toFixed(1);
  })();

  useEffect(() => {
    const token = localStorage.getItem("bo_token");
    fetch(`${API}/admin/sports/events?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { if (d.data?.events?.length) { setApiEvents(d.data.events); setApiLoaded(true); } })
      .catch(() => {});
  }, []);

  async function toggleMarket(marketId: string, suspended: boolean) {
    const token = localStorage.getItem("bo_token");
    await fetch(`${API}/admin/sports/markets/${marketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isSuspended: suspended }),
    });
    toast.success(suspended ? "Marché suspendu" : "Marché activé");
  }

  async function saveOdd() {
    if (!editOdd) return;
    const token = localStorage.getItem("bo_token");
    const res = await fetch(`${API}/admin/sports/odds/${editOdd.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ value: parseFloat(editOdd.value) }),
    });
    if (res.ok) { toast.success("Cote mise à jour ✓"); setEditOdd(null); }
    else toast.error("Erreur");
  }

  function saveMatch() {
    if (!form.t1 || !form.t2) { toast.error("Renseignez les deux équipes"); return; }
    toast.success("Match enregistré ✓");
    setForm({ t1: "", t2: "", comp: "", date: "", sport: "Football", status: "Programmé", o1: "1.80", oX: "3.40", o2: "4.00" });
  }

  const filtered = DEMO_MATCHES.filter((m) =>
    !search || [m.t1, m.t2, m.comp].some((s) => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      {/* Formulaire création/édition */}
      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">➕ Créer / Modifier un match</span>
        </div>
        <div className="bo-card-body space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { key: "t1",   label: "Équipe domicile",   ph: "ex: Real Madrid" },
              { key: "t2",   label: "Équipe extérieur",  ph: "ex: Bayern Munich" },
              { key: "comp", label: "Compétition",       ph: "ex: Ligue des Champions" },
            ].map(({ key, label, ph }) => (
              <div key={key}>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">{label}</label>
                <input className="bo-input w-full" placeholder={ph} value={form[key as keyof typeof form]} onChange={up(key)} />
              </div>
            ))}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Date & heure</label>
              <input type="datetime-local" className="bo-input w-full" value={form.date} onChange={up("date")} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Sport</label>
              <select className="bo-select w-full" value={form.sport} onChange={up("sport")}>
                {["Football","Basketball","Tennis","Rugby","MMA","Hockey","Volleyball"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Statut</label>
              <select className="bo-select w-full" value={form.status} onChange={up("status")}>
                {["Programmé","En direct","Terminé","Suspendu"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-2">Cotes 1X2</label>
            <div className="grid grid-cols-3 gap-3">
              {[{ key: "o1", label: "1 — Domicile" }, { key: "oX", label: "X — Nul" }, { key: "o2", label: "2 — Extérieur" }].map(({ key, label }) => (
                <div key={key} className="bg-bo-input border border-bo-border2 rounded-lg p-3">
                  <p className="text-[9px] uppercase tracking-wider text-t-faint mb-1">{label}</p>
                  <input
                    type="number" step="0.01" min="1"
                    className="bg-transparent border-none outline-none text-green-400 font-bold text-xl w-full font-mono"
                    value={form[key as keyof typeof form]} onChange={up(key)}
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-t-faint mt-2">
              Marge bookmaker : <span className={parseFloat(margin) > 0 ? "text-green-400" : "text-red-400"}>{margin}%</span>
              {parseFloat(margin) > 0 ? " (bénéfice)" : " (déficit)"}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button className="bo-btn-secondary" onClick={() => setForm({ t1: "", t2: "", comp: "", date: "", sport: "Football", status: "Programmé", o1: "1.80", oX: "3.40", o2: "4.00" })}>
              ↺ Réinitialiser
            </button>
            <button className="bo-btn-primary" onClick={saveMatch}>✓ Enregistrer le match</button>
          </div>
        </div>
      </div>

      {/* Cotes en direct (API) */}
      {apiLoaded && apiEvents.length > 0 && (
        <div className="bo-card">
          <div className="bo-card-header">
            <span className="bo-card-title">⚡ Cotes en temps réel (API)</span>
            <span className="text-[11px] text-green-400">{apiEvents.length} événements</span>
          </div>
          <div className="bo-card-body space-y-3">
            {apiEvents.map((event) => (
              <div key={event.id} className="bg-bo-surface border border-bo-border2 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-t-primary text-sm">{event.homeTeam} <span className="text-t-faint">vs</span> {event.awayTeam}</p>
                  <span className={event.status === "LIVE" ? "bo-badge-red" : "bo-badge-blue"}>{event.status}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {event.markets?.map((market: any) => (
                    <div key={market.id} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-t-faint">{market.name}:</span>
                      {market.odds?.map((odd: any) => (
                        <div key={odd.id}>
                          {editOdd?.id === odd.id ? (
                            <div className="flex items-center gap-1">
                              <input type="number" step="0.01" className="bo-input w-16 text-xs py-1 font-mono"
                                value={editOdd.value} onChange={(e) => setEditOdd({ id: odd.id, value: e.target.value })} />
                              <button onClick={saveOdd} className="text-green-400 text-xs">✓</button>
                              <button onClick={() => setEditOdd(null)} className="text-t-faint text-xs">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => setEditOdd({ id: odd.id, value: Number(odd.value).toFixed(2) })}
                              className="bg-bo-input border border-bo-border2 rounded px-2 py-0.5 text-green-400 font-bold font-mono text-xs hover:border-green-500 transition-colors">
                              {odd.label} {Number(odd.value).toFixed(2)}
                            </button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => toggleMarket(market.id, !market.isSuspended)}
                        className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${market.isSuspended ? "bo-badge-red border-red-500/20" : "bo-badge-green border-green-500/20"}`}>
                        {market.isSuspended ? "SUSPENDU" : "ACTIF"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tableau matchs demo */}
      <div className="bo-filter-bar">
        <input className="bo-input flex-1" placeholder="Rechercher un match…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="bo-select">
          {["Tous les statuts","Programmé","En direct","Terminé"].map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="bo-select">
          {["Tous les sports","Football","Basketball","Tennis"].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">📋 Matchs programmés</span>
          <span className="text-[11px] text-t-faint">{filtered.length} match{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <table className="bo-table">
          <thead>
            <tr><th>Match</th><th>Compétition</th><th>Date</th><th>Cotes (1 / X / 2)</th><th>Marge</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong className="text-t-primary">{m.t1}</strong>
                  <span className="text-t-faint mx-1.5 text-[10px]">VS</span>
                  <strong className="text-t-primary">{m.t2}</strong>
                </td>
                <td>{m.comp}</td>
                <td className="font-mono text-t-faint">{m.date}</td>
                <td className="font-mono">
                  <span className="text-green-400 font-bold">{m.o1}</span>
                  <span className="text-t-faint mx-1">/</span>
                  <span className="text-t-muted">{m.oX}</span>
                  <span className="text-t-faint mx-1">/</span>
                  <span className="text-t-muted">{m.o2}</span>
                </td>
                <td className="font-mono text-t-faint">{m.margin}%</td>
                <td>{statusBadge(m.status)}</td>
                <td>
                  <div className="flex gap-1.5">
                    <button className="bo-btn-secondary bo-btn-sm">✎</button>
                    <button className="bo-btn-danger bo-btn-sm" onClick={() => toast("Match supprimé")}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
