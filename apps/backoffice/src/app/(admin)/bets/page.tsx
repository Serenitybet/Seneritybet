"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatXAF } from "@serenitybet/shared";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

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

export default function BetsPage() {
  const searchParams = useSearchParams();
  const manualOnly = searchParams.get("manual") === "true";
  const [bets, setBets]   = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("Tous");

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem("bo_token");
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (manualOnly) params.set("manual", "true");
    fetch(`${API}/admin/bets?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.data) { setBets(d.data.bets ?? []); setTotal(d.data.total ?? 0); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, manualOnly]);

  const filtered = statusFilter === "Tous" ? bets : bets.filter(b => b.status === statusFilter);

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="bo-filter-bar">
        <input className="bo-input flex-1" placeholder="Rechercher par utilisateur, match…" />
        <select className="bo-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {["Tous","PENDING","WON","LOST","CANCELLED","MANUAL_REVIEW"].map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
          ))}
        </select>
        <button className="bo-btn-secondary">↓ Export CSV</button>
      </div>

      {/* Tableau */}
      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">🎯 {manualOnly ? "Paris en revue risque" : "Tous les paris"}</span>
          <span className="text-[11px] text-t-faint">{loading ? "Chargement…" : `${total} paris`}</span>
        </div>

        {loading && (
          <div className="p-12 text-center text-t-faint">
            <div className="w-6 h-6 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-3" />
            Chargement des paris…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="p-12 text-center text-t-faint">
            <div className="text-4xl mb-2">🎯</div>
            <p className="font-semibold text-t-primary mb-1">Aucun pari trouvé</p>
            <p className="text-sm">Les paris des joueurs apparaîtront ici.</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <table className="bo-table">
            <thead>
              <tr>
                <th>#ID</th>
                <th>Parieur</th>
                <th>Mise</th>
                <th>Cote</th>
                <th>Gain pot.</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((bet: any) => (
                <tr key={bet.id} className={bet.status === "MANUAL_REVIEW" ? "border-l-2 !border-l-orange-500" : ""}>
                  <td className="font-mono text-t-faint text-[11px]">{bet.id?.slice(-8).toUpperCase()}</td>
                  <td>
                    <div>
                      <p className="text-t-primary font-medium">{bet.user?.firstName} {bet.user?.lastName}</p>
                      <p className="text-t-faint text-[10px]">{bet.user?.email}</p>
                    </div>
                  </td>
                  <td className="font-mono text-t-primary">{formatXAF(Number(bet.stake))}</td>
                  <td className="font-mono text-green-400 font-bold">{Number(bet.totalOdds ?? 0).toFixed(2)}</td>
                  <td className="font-mono text-t-primary">{formatXAF(Number(bet.potentialWin))}</td>
                  <td>{betBadge(bet.status)}</td>
                  <td className="text-t-faint text-xs">{new Date(bet.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td>
                    {bet.status === "PENDING" && (
                      <button className="bo-btn-danger bo-btn-sm" onClick={() => toast("Annulation non implémentée")}>✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && total > 0 && (
          <div className="flex justify-between items-center p-3 border-t border-bo-border">
            <span className="text-[11px] text-t-faint">Page {page} — {total} paris</span>
            <div className="flex gap-2">
              <button className="bo-btn-secondary bo-btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Préc.</button>
              <button className="bo-btn-secondary bo-btn-sm" disabled={bets.length < 25} onClick={() => setPage(p => p + 1)}>Suiv. →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
