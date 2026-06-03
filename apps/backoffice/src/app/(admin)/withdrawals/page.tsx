"use client";

import { useEffect, useState } from "react";
import { formatXAF } from "@serenitybet/shared";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

export default function WithdrawalsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  function token() { return localStorage.getItem("bo_token"); }

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/withdrawals`, { headers: { Authorization: `Bearer ${token()}` } });
      const d = await res.json();
      if (d.data) setRequests(d.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { loadRequests(); }, []);

  const pending   = requests.filter(r => r.status === "PENDING");
  const totalXAF  = pending.reduce((s, r) => s + Number(r.amount), 0) / 100;
  const validated = requests.filter(r => r.status === "VALIDATED").length;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="kpi-card">
          <div className="kpi-label">⏳ En attente</div>
          <div className="kpi-value text-orange-400">{loading ? "…" : pending.length}</div>
          <div className="kpi-delta text-t-faint">Demandes à traiter</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">💰 Montant en attente</div>
          <div className="kpi-value text-t-primary">{loading ? "…" : formatXAF(totalXAF * 100)}</div>
          <div className="kpi-delta text-t-faint">À distribuer</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">✓ Validés</div>
          <div className="kpi-value text-green-400">{loading ? "…" : validated}</div>
          <div className="kpi-delta text-t-faint">Total traités</div>
        </div>
      </div>

      {/* Tableau */}
      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">💸 Demandes de retrait espèces</span>
          <span className="bo-badge-orange">{pending.length} en attente</span>
        </div>

        {loading && (
          <div className="p-12 text-center text-t-faint">
            <div className="w-6 h-6 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-3" />
            Chargement…
          </div>
        )}

        {!loading && requests.length === 0 && (
          <div className="p-12 text-center text-t-faint">
            <div className="text-4xl mb-2">💸</div>
            <p className="font-semibold text-t-primary mb-1">Aucune demande de retrait</p>
            <p className="text-sm">Les demandes des joueurs apparaîtront ici.</p>
          </div>
        )}

        {!loading && requests.length > 0 && (
          <table className="bo-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Joueur</th>
                <th>Montant</th>
                <th>Boutique</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Expire</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r: any) => (
                <tr key={r.id}>
                  <td className="font-mono font-bold text-green-400">#{r.requestCode}</td>
                  <td>
                    <div>
                      <p className="text-t-primary font-medium">{r.user?.firstName} {r.user?.lastName}</p>
                      <p className="text-t-faint text-[10px]">{r.user?.phone}</p>
                    </div>
                  </td>
                  <td className="font-mono font-bold text-t-primary">{formatXAF(Number(r.amount) / 100 * 100)}</td>
                  <td className="text-t-muted text-sm">{r.shop?.name} — {r.shop?.city}</td>
                  <td className="text-t-faint text-xs">{new Date(r.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td>
                    {r.status === "PENDING"   && <span className="bo-badge-orange">⏳ En attente</span>}
                    {r.status === "VALIDATED" && <span className="bo-badge-green">✓ Validé</span>}
                    {r.status === "CANCELLED" && <span className="bo-badge-gray">Annulé</span>}
                    {r.status === "EXPIRED"   && <span className="bo-badge-red">Expiré</span>}
                  </td>
                  <td className="text-t-faint text-xs">
                    {r.status === "PENDING" ? new Date(r.expiresAt).toLocaleString("fr-FR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
