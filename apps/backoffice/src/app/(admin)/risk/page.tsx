"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

export default function RiskPage() {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const [approvalThreshold, setApprovalThreshold] = useState("");
  const [maxWin, setMaxWin]                       = useState("");
  const [cashoutMargin, setCashoutMargin]         = useState("");
  const [cashoutMaxOdd, setCashoutMaxOdd]         = useState("");

  function token() { return localStorage.getItem("bo_token"); }

  async function load() {
    setLoading(true);
    try {
      const [t, m, c] = await Promise.all([
        fetch(`${API}/admin/settings/tpe-payout-threshold`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json()),
        fetch(`${API}/admin/settings/tpe-max-win`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json()),
        fetch(`${API}/admin/settings/cashout`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json()),
      ]);
      if (t.data) setApprovalThreshold(String(t.data.thresholdXAF));
      if (m.data) setMaxWin(String(m.data.maxWinXAF));
      if (c.data) { setCashoutMargin(String(c.data.marginPct)); setCashoutMaxOdd(String(c.data.maxOddPending)); }
    } catch { toast.error("Erreur de chargement"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function saveApprovalThreshold(e: React.FormEvent) {
    e.preventDefault();
    if (approvalThreshold === "" || isNaN(Number(approvalThreshold)) || Number(approvalThreshold) < 0) {
      toast.error("Seuil invalide"); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/settings/tpe-payout-threshold`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ thresholdXAF: Number(approvalThreshold) }),
      });
      if (!res.ok) { toast.error("Erreur"); return; }
      toast.success("Seuil de validation manuelle mis à jour ✓");
    } catch { toast.error("Erreur réseau"); }
    finally { setSaving(false); }
  }

  async function saveMaxWin(e: React.FormEvent) {
    e.preventDefault();
    if (maxWin === "" || isNaN(Number(maxWin)) || Number(maxWin) < 0) {
      toast.error("Plafond invalide"); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/settings/tpe-max-win`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ maxWinXAF: Number(maxWin) }),
      });
      if (!res.ok) { toast.error("Erreur"); return; }
      toast.success(Number(maxWin) === 0 ? "Plafond de gain désactivé ✓" : "Plafond de gain mis à jour ✓");
    } catch { toast.error("Erreur réseau"); }
    finally { setSaving(false); }
  }

  async function saveCashout(e: React.FormEvent) {
    e.preventDefault();
    if (cashoutMargin === "" || isNaN(Number(cashoutMargin)) || Number(cashoutMargin) < 0 || Number(cashoutMargin) > 100) {
      toast.error("Marge invalide (0 à 100)"); return;
    }
    if (cashoutMaxOdd === "" || isNaN(Number(cashoutMaxOdd)) || Number(cashoutMaxOdd) < 1.01) {
      toast.error("Cote maximum invalide (min 1.01)"); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/settings/cashout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ marginPct: Number(cashoutMargin), maxOddPending: Number(cashoutMaxOdd) }),
      });
      if (!res.ok) { toast.error("Erreur"); return; }
      toast.success("Paramètres du cash-out mis à jour ✓");
    } catch { toast.error("Erreur réseau"); }
    finally { setSaving(false); }
  }

  if (loading) {
    return <div className="bo-card p-12 text-center text-t-faint">Chargement…</div>;
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-lg font-bold text-t-primary">🛡️ Gestion du risque</h1>
        <p className="text-[11px] text-t-faint mt-0.5">
          Limite les gros gains sur les tickets physiques pour protéger la trésorerie et éviter les litiges avec les parieurs.
        </p>
      </div>

      <form onSubmit={saveMaxWin} className="bo-card p-5 space-y-4">
        <div>
          <h2 className="font-bold text-[13px] text-t-primary flex items-center gap-2">
            <span>🚫</span> Plafond de gain maximum
          </h2>
          <p className="text-[11px] text-t-faint mt-1 leading-relaxed">
            Si le gain potentiel d'un coupon dépasserait ce montant, le ticket est <strong>refusé à la caisse</strong> avant
            même d'être créé — le caissier reçoit directement la mise maximale acceptée pour ce coupon, à faire valider par
            le parieur. Aucun ticket n'est jamais payé en dessous de ce qu'annoncent les cotes affichées.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-t-faint block mb-1">Gain maximum autorisé (XAF)</label>
            <input
              type="number" min="0" step="1000"
              className="bo-input w-full text-right font-mono"
              value={maxWin}
              onChange={e => setMaxWin(e.target.value)}
              placeholder="0 = désactivé"
            />
          </div>
          <button type="submit" disabled={saving} className="bo-btn-primary">
            {saving ? "…" : "💾 Enregistrer"}
          </button>
        </div>
        {Number(maxWin) === 0 && (
          <p className="text-[10px] text-gold">⚠️ Plafond désactivé — aucun montant maximum n'est actuellement appliqué.</p>
        )}
      </form>

      <form onSubmit={saveApprovalThreshold} className="bo-card p-5 space-y-4">
        <div>
          <h2 className="font-bold text-[13px] text-t-primary flex items-center gap-2">
            <span>✅</span> Seuil de validation manuelle
          </h2>
          <p className="text-[11px] text-t-faint mt-1 leading-relaxed">
            Un ticket gagnant dont le gain dépasse ce seuil reste bloqué au statut "en attente d'approbation" — un admin
            doit valider le paiement dans Tickets TPE avant que le caissier puisse encaisser. Protège contre la fraude ou
            l'erreur de saisie, en complément du plafond ci-dessus.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-t-faint block mb-1">Seuil de validation (XAF)</label>
            <input
              type="number" min="0" step="1000"
              className="bo-input w-full text-right font-mono"
              value={approvalThreshold}
              onChange={e => setApprovalThreshold(e.target.value)}
            />
          </div>
          <button type="submit" disabled={saving} className="bo-btn-primary">
            {saving ? "…" : "💾 Enregistrer"}
          </button>
        </div>
      </form>

      <form onSubmit={saveCashout} className="bo-card p-5 space-y-4">
        <div>
          <h2 className="font-bold text-[13px] text-t-primary flex items-center gap-2">
            <span>💸</span> Cash-out
          </h2>
          <p className="text-[11px] text-t-faint mt-1 leading-relaxed">
            Permet à un parieur d'encaisser un ticket en cours avant son règlement final (site public, puis paiement en
            espèces au TPE). Proposé seulement si aucune sélection n'est en direct, aucune perdante, et si chaque
            sélection pas encore jouée est un favori (cote ≤ seuil ci-dessous).
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-t-faint block mb-1">Marge retenue (%)</label>
            <input
              type="number" min="0" max="100" step="1"
              className="bo-input w-full text-right font-mono"
              value={cashoutMargin}
              onChange={e => setCashoutMargin(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] text-t-faint block mb-1">Cote max. sélection à venir</label>
            <input
              type="number" min="1.01" step="0.05"
              className="bo-input w-full text-right font-mono"
              value={cashoutMaxOdd}
              onChange={e => setCashoutMaxOdd(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="bo-btn-primary">
            {saving ? "…" : "💾 Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
