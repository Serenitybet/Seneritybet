"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

export default function PartnersPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [newRate, setNewRate]   = useState("");

  function token() { return localStorage.getItem("bo_token"); }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/partners`, { headers: { Authorization: `Bearer ${token()}` } });
      const d = await res.json();
      if (d.data) setPartners(d.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`${API}/admin/partners/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { toast.success(`Partenaire ${status === "ACTIVE" ? "activé" : "suspendu"} ✓`); load(); setSelected(null); }
    else toast.error("Erreur");
  }

  async function updateCommission(id: string) {
    const rate = parseFloat(newRate) / 100;
    if (isNaN(rate) || rate < 0 || rate > 1) { toast.error("Taux invalide (0-100%)"); return; }
    const res = await fetch(`${API}/admin/partners/${id}/commission`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ commissionRate: rate }),
    });
    if (res.ok) { toast.success("Commission mise à jour ✓"); load(); setNewRate(""); }
    else toast.error("Erreur");
  }

  async function processWithdrawal(id: string, status: "PAID" | "REJECTED") {
    const res = await fetch(`${API}/admin/partners/withdrawals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { toast.success(status === "PAID" ? "Paiement confirmé ✓" : "Demande rejetée"); load(); }
    else toast.error("Erreur");
  }

  const pending  = partners.filter(p => p.status === "PENDING");
  const active   = partners.filter(p => p.status === "ACTIVE");

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="kpi-card">
          <div className="kpi-label">🤝 Partenaires actifs</div>
          <div className="kpi-value text-green-400">{active.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">⏳ En attente</div>
          <div className="kpi-value text-orange-400">{pending.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">👥 Total filleuls</div>
          <div className="kpi-value text-t-primary">
            {partners.reduce((s, p) => s + (p._count?.referrals ?? 0), 0)}
          </div>
        </div>
      </div>

      {/* Demandes en attente */}
      {pending.length > 0 && (
        <div className="bo-card">
          <div className="bo-card-header">
            <span className="bo-card-title">⏳ Demandes en attente</span>
            <span className="bo-badge-orange">{pending.length} à traiter</span>
          </div>
          <div className="divide-y divide-bo-border">
            {pending.map(p => (
              <div key={p.id} className="flex items-center gap-4 p-4">
                <div className="flex-1">
                  <p className="font-semibold text-t-primary">{p.firstName} {p.lastName}</p>
                  <p className="text-xs text-t-faint">{p.email} · {p.phone}</p>
                  {p.bio && <p className="text-xs text-t-muted mt-0.5 italic">"{p.bio}"</p>}
                  {p.socialMedia && <a href={p.socialMedia} target="_blank" className="text-xs text-green-400 hover:underline">{p.socialMedia}</a>}
                </div>
                <div className="text-center">
                  <p className="text-xs text-t-faint">Code demandé</p>
                  <p className="font-mono font-bold text-t-primary">{p.promoCode}</p>
                </div>
                <div className="flex gap-2">
                  <button className="bo-btn-primary bo-btn-sm" onClick={() => updateStatus(p.id, "ACTIVE")}>✓ Approuver</button>
                  <button className="bo-btn-danger bo-btn-sm" onClick={() => updateStatus(p.id, "SUSPENDED")}>✕ Rejeter</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Partenaires actifs */}
      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">🤝 Partenaires actifs</span>
          <span className="text-[11px] text-t-faint">{active.length} partenaires</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-t-faint">Chargement…</div>
        ) : active.length === 0 ? (
          <div className="p-8 text-center text-t-faint">Aucun partenaire actif</div>
        ) : (
          <table className="bo-table">
            <thead>
              <tr>
                <th>Partenaire</th>
                <th>Code promo</th>
                <th>Filleuls</th>
                <th>Commission</th>
                <th>Gains totaux</th>
                <th>Solde</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {active.map(p => (
                <tr key={p.id}>
                  <td>
                    <p className="font-medium text-t-primary">{p.firstName} {p.lastName}</p>
                    <p className="text-xs text-t-faint">{p.email}</p>
                  </td>
                  <td><span className="font-mono font-bold text-green-400">{p.promoCode}</span></td>
                  <td className="text-center">{p._count?.referrals ?? 0}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gold">{((p.commissionRate ?? 0.10) * 100).toFixed(0)}%</span>
                      <button onClick={() => { setSelected(p); setNewRate(String(Math.round(p.commissionRate * 100))); }}
                        className="bo-btn-secondary bo-btn-sm text-[10px]">✏️</button>
                    </div>
                  </td>
                  <td className="font-mono text-green-400">{(p.totalEarned ?? 0).toLocaleString("fr-FR")} XAF</td>
                  <td className="font-mono text-gold font-bold">{(p.balance ?? 0).toLocaleString("fr-FR")} XAF</td>
                  <td>
                    <button className="bo-btn-danger bo-btn-sm" onClick={() => updateStatus(p.id, "SUSPENDED")}>
                      Suspendre
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal modifier commission */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bo-card border border-bo-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-t-primary mb-4">Modifier le taux de commission</h3>
            <p className="text-sm text-t-muted mb-4">
              Partenaire : <strong className="text-t-primary">{selected.firstName} {selected.lastName}</strong><br/>
              Code : <strong className="text-green-400 font-mono">{selected.promoCode}</strong>
            </p>
            <div className="flex items-center gap-3 mb-4">
              <input type="number" min={1} max={50} className="bo-input flex-1"
                value={newRate} onChange={e => setNewRate(e.target.value)} placeholder="10" />
              <span className="text-t-muted font-bold">%</span>
            </div>
            <p className="text-xs text-t-faint mb-4">
              Le partenaire recevra ce pourcentage des pertes nettes de ses filleuls.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setSelected(null)} className="bo-btn-secondary flex-1">Annuler</button>
              <button onClick={() => updateCommission(selected.id)} className="bo-btn-primary flex-1">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
