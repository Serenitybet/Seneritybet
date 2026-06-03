"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

export default function KycPage() {
  const [kycList, setKycList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  function token() { return localStorage.getItem("bo_token"); }

  async function loadKyc() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/kyc`, { headers: { Authorization: `Bearer ${token()}` } });
      const d = await res.json();
      if (d.data) setKycList(d.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { loadKyc(); }, []);

  async function handleKyc(userId: string, name: string, action: "APPROVED" | "REJECTED") {
    try {
      const res = await fetch(`${API}/admin/users/${userId}/kyc`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ status: action }),
      });
      if (res.ok) {
        action === "APPROVED"
          ? toast.success(`KYC approuvé — ${name} ✓`)
          : toast.error(`KYC rejeté — ${name}`);
        loadKyc();
      }
    } catch { toast.error("Erreur réseau"); }
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="kpi-card">
          <div className="kpi-label">🪪 En attente</div>
          <div className="kpi-value text-orange-400">{loading ? "…" : kycList.filter(k => k.status === "PENDING" || k.status === "SUBMITTED").length}</div>
          <div className="kpi-delta text-t-faint">À valider</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">✓ Approuvés</div>
          <div className="kpi-value text-green-400">{loading ? "…" : kycList.filter(k => k.status === "APPROVED").length}</div>
          <div className="kpi-delta text-t-faint">Total</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">✕ Rejetés</div>
          <div className="kpi-value text-red-400">{loading ? "…" : kycList.filter(k => k.status === "REJECTED").length}</div>
          <div className="kpi-delta text-t-faint">Total</div>
        </div>
      </div>

      {/* Tableau */}
      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">🪪 Vérifications KYC</span>
          <span className="bo-badge-orange">{kycList.filter(k => k.status === "PENDING" || k.status === "SUBMITTED").length} en attente</span>
        </div>

        {loading && (
          <div className="p-12 text-center text-t-faint">
            <div className="w-6 h-6 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-3" />
            Chargement…
          </div>
        )}

        {!loading && kycList.length === 0 && (
          <div className="p-12 text-center text-t-faint">
            <div className="text-4xl mb-2">🪪</div>
            <p className="font-semibold text-t-primary mb-1">Aucune demande KYC</p>
            <p className="text-sm">Les demandes de vérification apparaîtront ici.</p>
          </div>
        )}

        {!loading && kycList.length > 0 && (
          <table className="bo-table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Type document</th>
                <th>Date soumission</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {kycList.map((k: any) => (
                <tr key={k.id}>
                  <td>
                    <div>
                      <p className="text-t-primary font-medium">{k.user?.firstName} {k.user?.lastName}</p>
                      <p className="text-t-faint text-[10px]">{k.user?.email}</p>
                    </div>
                  </td>
                  <td><span className="bo-badge-yellow">{k.idType}</span></td>
                  <td className="text-t-faint">{new Date(k.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td>
                    {k.status === "APPROVED" && <span className="bo-badge-green">✓ Approuvé</span>}
                    {k.status === "REJECTED" && <span className="bo-badge-red">✕ Rejeté</span>}
                    {(k.status === "PENDING" || k.status === "SUBMITTED") && <span className="bo-badge-orange">⏳ En attente</span>}
                  </td>
                  <td>
                    {(k.status === "PENDING" || k.status === "SUBMITTED") && (
                      <div className="flex gap-2">
                        <button className="bo-btn-primary bo-btn-sm" onClick={() => handleKyc(k.userId, `${k.user?.firstName}`, "APPROVED")}>
                          ✓ Approuver
                        </button>
                        <button className="bo-btn-danger bo-btn-sm" onClick={() => handleKyc(k.userId, `${k.user?.firstName}`, "REJECTED")}>
                          ✕ Rejeter
                        </button>
                      </div>
                    )}
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
