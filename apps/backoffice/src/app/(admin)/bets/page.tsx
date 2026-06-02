"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatXAF } from "@serenitybet/shared";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

const DEMO_BETS = [
  { id: "#BT-4821", user: "@mbaye_d",  name: "Mbaye Diop",    type: "Simple",  match: "Real Madrid vs Bayern",   sel: "Bayern",   mise: 5000,   cote: 2.80, gain: 14000,  status: "PENDING",       manual: false },
  { id: "#BT-4820", user: "@ali_hass", name: "Ali Hassan",    type: "Simple",  match: "Cameroun vs Nigeria",     sel: "Cameroun", mise: 20000,  cote: 1.72, gain: 34400,  status: "PENDING",       manual: false },
  { id: "#BT-4819", user: "@fatou_k",  name: "Fatou Koné",    type: "Combiné", match: "PSG vs Arsenal",          sel: "Nul",      mise: 3000,   cote: 3.45, gain: 10350,  status: "WON",           manual: false },
  { id: "#BT-4818", user: "@jean_p",   name: "Jean Pierre",   type: "Simple",  match: "Barça vs Séville",        sel: "Barça",    mise: 10000,  cote: 1.45, gain: 14500,  status: "LOST",          manual: false },
  { id: "#BT-4817", user: "@omar_s",   name: "Omar Saleh",    type: "Simple",  match: "Inter vs Atletico",       sel: "Inter",    mise: 7500,   cote: 2.05, gain: 15375,  status: "PENDING",       manual: false },
  { id: "#BT-4816", user: "@aisha_m",  name: "Aisha Moussa",  type: "Combiné", match: "Chelsea vs Tottenham",    sel: "Chelsea",  mise: 2500,   cote: 1.95, gain: 4875,   status: "WON",           manual: false },
  { id: "#BT-4815", user: "@hassan_b", name: "Hassan Boukar", type: "Simple",  match: "Man City vs Liverpool",   sel: "City",     mise: 50000,  cote: 2.10, gain: 105000, status: "MANUAL_REVIEW", manual: true },
];

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En cours", WON: "Gagné", LOST: "Perdu",
  CANCELLED: "Annulé", REFUNDED: "Remboursé", MANUAL_REVIEW: "⚠️ Revue risque",
};

function betBadge(s: string) {
  if (s === "WON")           return <span className="bo-badge-green">Gagné</span>;
  if (s === "LOST")          return <span className="bo-badge-red">Perdu</span>;
  if (s === "CANCELLED")     return <span className="bo-badge-gray">Annulé</span>;
  if (s === "MANUAL_REVIEW") return <span className="bo-badge-orange">⚠ Revue</span>;
  return <span className="bo-badge-blue">En cours</span>;
}

function typeBadge(t: string) {
  if (t === "Combiné") return <span className="bo-badge-orange">Combiné</span>;
  return <span className="bo-badge-yellow">Simple</span>;
}

export default function BetsPage() {
  const searchParams = useSearchParams();
  const manualOnly = searchParams.get("manual") === "true";
  const [apiBets, setApiBets] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [apiLoaded, setApiLoaded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("bo_token");
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (manualOnly) params.set("manual", "true");
    fetch(`${API}/admin/bets?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { if (d.data?.bets?.length) { setApiBets(d.data.bets); setTotal(d.data.total); setApiLoaded(true); } })
      .catch(() => {});
  }, [page, manualOnly]);

  const displayBets = apiLoaded
    ? apiBets
    : DEMO_BETS.filter((b) => !manualOnly || b.manual)
               .filter((b) => statusFilter === "Tous" || b.status === statusFilter);

  const counts = {
    WON: DEMO_BETS.filter(b => b.status === "WON").length,
    LOST: DEMO_BETS.filter(b => b.status === "LOST").length,
    PENDING: DEMO_BETS.filter(b => b.status === "PENDING").length,
    MANUAL_REVIEW: DEMO_BETS.filter(b => b.status === "MANUAL_REVIEW").length,
  };

  return (
    <div className="space-y-4">
      {/* Compteurs */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="bo-badge-green">Gagné : {counts.WON}</span>
        <span className="bo-badge-red">Perdu : {counts.LOST}</span>
        <span className="bo-badge-blue">En cours : {counts.PENDING}</span>
        {counts.MANUAL_REVIEW > 0 && <span className="bo-badge-orange">⚠ Revue : {counts.MANUAL_REVIEW}</span>}
      </div>

      {/* Filtres */}
      <div className="bo-filter-bar">
        <input className="bo-input flex-1" placeholder="Rechercher par utilisateur, match…" />
        <select className="bo-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {["Tous","PENDING","WON","LOST","CANCELLED","MANUAL_REVIEW"].map(s => <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>)}
        </select>
        <select className="bo-select">
          {["Aujourd'hui","7 jours","30 jours"].map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="bo-btn-secondary">↓ Export CSV</button>
      </div>

      {/* Tableau */}
      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">🎯 {manualOnly ? "Paris en revue risque" : "Tous les paris"}</span>
          <span className="text-[11px] text-t-faint">{apiLoaded ? total : DEMO_BETS.length} paris</span>
        </div>
        <table className="bo-table">
          <thead>
            <tr>
              <th>#ID</th>
              <th>Parieur</th>
              <th>Type</th>
              <th>Match</th>
              <th>Sélection</th>
              <th>Mise</th>
              <th>Cote</th>
              <th>Gain pot.</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {displayBets.map((bet: any) => (
              <tr key={bet.id} className={bet.manual || bet.status === "MANUAL_REVIEW" ? "border-l-2 !border-l-orange-500" : ""}>
                <td className="font-mono text-t-faint text-[11px]">{bet.id}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center text-[9px] text-green-400 font-bold shrink-0">
                      {(bet.user ?? bet.name)?.[1]?.toUpperCase()}
                    </div>
                    <span>{bet.user ?? `${bet.user?.firstName} ${bet.user?.lastName}`}</span>
                  </div>
                </td>
                <td>{typeBadge(bet.type ?? (bet.type === "ACCUMULATOR" ? "Combiné" : "Simple"))}</td>
                <td className="text-t-muted max-w-[160px] truncate">{bet.match ?? `${bet.selections?.[0]?.event?.homeTeam ?? ""} vs …`}</td>
                <td><span className="bo-badge-yellow text-[10px]">{bet.sel ?? bet.selections?.[0]?.oddLabel}</span></td>
                <td className="font-mono text-t-primary">{formatXAF(typeof bet.mise === "number" ? bet.mise * 100 : Number(bet.stake))}</td>
                <td className="font-mono text-green-400 font-bold">{(bet.cote ?? Number(bet.totalOdds) ?? 0).toFixed(2)}</td>
                <td className="font-mono text-t-primary">{formatXAF(typeof bet.gain === "number" ? bet.gain * 100 : Number(bet.potentialWin))}</td>
                <td>{betBadge(bet.status)}</td>
                <td>
                  {(bet.status === "PENDING" || bet.status === "MANUAL_REVIEW") && (
                    <button className="bo-btn-danger bo-btn-sm" onClick={() => toast("Pari annulé")}>✕ Annuler</button>
                  )}
                  {(bet.status === "WON" || bet.status === "LOST") && (
                    <button className="bo-btn-secondary bo-btn-sm">👁</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {apiLoaded && (
          <div className="flex justify-between items-center p-3 border-t border-bo-border">
            <span className="text-[11px] text-t-faint">Page {page} — {total} paris</span>
            <div className="flex gap-2">
              <button className="bo-btn-secondary bo-btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Préc.</button>
              <button className="bo-btn-secondary bo-btn-sm" disabled={apiBets.length < 25} onClick={() => setPage(p => p + 1)}>Suiv. →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
