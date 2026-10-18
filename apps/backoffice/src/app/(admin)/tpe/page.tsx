"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

interface Tpe {
  id: string;
  code: string;
  name: string | null;
  pairingCode: string | null;
  status: "PENDING_PAIRING" | "ACTIVE" | "BLOCKED" | "DELETED";
  creditXAF: number;
  lastSeenAt: string | null;
  pairedAt: string | null;
}

interface PendingPayout {
  id: string;
  code: string;
  stakeXAF: number;
  potentialWinXAF: number;
  settledAt: string;
  tpe: { code: string; name: string | null };
}

function fmtXAF(v: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(v)) + " XAF";
}

function timeAgo(iso: string | null) {
  if (!iso) return "jamais";
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "à l'instant";
  if (sec < 3600) return `${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h`;
  return `${Math.floor(sec / 86400)} j`;
}

const STATUS_BADGE: Record<Tpe["status"], string> = {
  PENDING_PAIRING: "bo-badge-yellow",
  ACTIVE: "bo-badge-green",
  BLOCKED: "bo-badge-red",
  DELETED: "bo-badge-gray",
};
const STATUS_LABEL: Record<Tpe["status"], string> = {
  PENDING_PAIRING: "En attente d'appairage",
  ACTIVE: "Actif",
  BLOCKED: "Bloqué",
  DELETED: "Supprimé",
};

export default function TpePage() {
  const [tpes, setTpes] = useState<Tpe[]>([]);
  const [payouts, setPayouts] = useState<PendingPayout[]>([]);
  const [threshold, setThreshold] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [creditModal, setCreditModal] = useState<Tpe | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [saving, setSaving] = useState(false);

  function token() { return localStorage.getItem("bo_token"); }
  function authHeaders(extra?: Record<string, string>) {
    return { Authorization: `Bearer ${token()}`, ...extra };
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [tpeRes, payoutRes, thresholdRes] = await Promise.all([
        fetch(`${API}/admin/tpe`, { headers: authHeaders() }),
        fetch(`${API}/admin/tpe/payouts/pending`, { headers: authHeaders() }),
        fetch(`${API}/admin/settings/tpe-payout-threshold`, { headers: authHeaders() }),
      ]);
      const tpeData = await tpeRes.json();
      const payoutData = await payoutRes.json();
      const thresholdData = await thresholdRes.json();
      if (tpeData.data) setTpes(tpeData.data);
      if (payoutData.data) setPayouts(payoutData.data);
      if (thresholdData.data) setThreshold(String(thresholdData.data.thresholdXAF));
    } catch { toast.error("Erreur de chargement"); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  async function approvePairing(tpe: Tpe) {
    const name = prompt(`Nom du TPE (code actuel ${tpe.code}) :`, tpe.name ?? "");
    if (name === null) return;
    try {
      const res = await fetch(`${API}/admin/tpe/${tpe.id}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success(`${tpe.code} activé ✓`);
      loadAll();
    } catch { toast.error("Erreur réseau"); }
  }

  async function toggleBlock(tpe: Tpe) {
    const action = tpe.status === "BLOCKED" ? "unblock" : "block";
    if (!confirm(`${action === "block" ? "Bloquer" : "Débloquer"} "${tpe.code}" ?`)) return;
    try {
      const res = await fetch(`${API}/admin/tpe/${tpe.id}/${action}`, { method: "POST", headers: authHeaders() });
      if (res.ok) { toast.success(`${tpe.code} ${action === "block" ? "bloqué" : "débloqué"} ✓`); loadAll(); }
      else toast.error("Erreur");
    } catch { toast.error("Erreur réseau"); }
  }

  async function removeTpe(tpe: Tpe) {
    if (!confirm(`Supprimer définitivement "${tpe.code}" ? Cette action est irréversible.`)) return;
    try {
      const res = await fetch(`${API}/admin/tpe/${tpe.id}`, { method: "DELETE", headers: authHeaders() });
      if (res.ok) { toast.success(`${tpe.code} supprimé ✓`); loadAll(); }
      else toast.error("Erreur");
    } catch { toast.error("Erreur réseau"); }
  }

  async function submitCredit(e: React.FormEvent) {
    e.preventDefault();
    if (!creditModal || !creditAmount) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/tpe/${creditModal.id}/credit`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ amountXAF: Number(creditAmount), reason: creditReason }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success("Crédit ajusté ✓");
      setCreditModal(null); setCreditAmount(""); setCreditReason("");
      loadAll();
    } catch { toast.error("Erreur réseau"); }
    finally { setSaving(false); }
  }

  async function saveThreshold() {
    try {
      const res = await fetch(`${API}/admin/settings/tpe-payout-threshold`, {
        method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ thresholdXAF: Number(threshold) }),
      });
      if (res.ok) toast.success("Seuil mis à jour ✓");
      else toast.error("Erreur");
    } catch { toast.error("Erreur réseau"); }
  }

  async function approvePayout(p: PendingPayout) {
    try {
      const res = await fetch(`${API}/admin/tpe/payouts/${p.id}/approve`, { method: "POST", headers: authHeaders() });
      if (res.ok) { toast.success(`Paiement ${p.code} approuvé ✓`); loadAll(); }
      else toast.error("Erreur");
    } catch { toast.error("Erreur réseau"); }
  }

  async function rejectPayout(p: PendingPayout) {
    if (!confirm(`Rejeter le paiement du ticket ${p.code} ? Il sera annulé.`)) return;
    try {
      const res = await fetch(`${API}/admin/tpe/payouts/${p.id}/reject`, { method: "POST", headers: authHeaders() });
      if (res.ok) { toast.success(`Paiement ${p.code} rejeté`); loadAll(); }
      else toast.error("Erreur");
    } catch { toast.error("Erreur réseau"); }
  }

  const pending = tpes.filter(t => t.status === "PENDING_PAIRING");
  const others = tpes.filter(t => t.status !== "PENDING_PAIRING");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bo-filter-bar flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-t-primary">🖥️ Terminaux TPE</h1>
          <p className="text-[11px] text-t-faint mt-0.5">
            {tpes.filter(t => t.status === "ACTIVE").length} actifs · {pending.length} en attente d'appairage
          </p>
        </div>
      </div>

      {/* Seuil d'approbation */}
      <div className="bo-card p-4 flex items-center gap-3 flex-wrap">
        <span className="bo-card-title">⚠️ Seuil d'approbation des paiements</span>
        <input type="number" className="bo-input w-32" value={threshold} onChange={e => setThreshold(e.target.value)} />
        <span className="text-[11px] text-t-faint">XAF — tout gain au-dessus doit être approuvé par le backoffice avant paiement</span>
        <button className="bo-btn-primary bo-btn-sm ml-auto" onClick={saveThreshold}>Enregistrer</button>
      </div>

      {/* Appairages en attente */}
      {pending.length > 0 && (
        <div className="bo-card">
          <div className="bo-card-header">
            <span className="bo-card-title">🔗 Appairages en attente</span>
            <span className="text-[11px] text-t-faint">{pending.length} appareil(s)</span>
          </div>
          <div className="divide-y divide-bo-border">
            {pending.map(t => (
              <div key={t.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-t-primary">{t.code}</p>
                  <p className="text-xs text-t-faint">Code d'appairage affiché sur l'appareil :</p>
                  <p className="font-mono text-lg font-black text-gold tracking-widest">{t.pairingCode}</p>
                </div>
                <div className="flex gap-2">
                  <button className="bo-btn-secondary bo-btn-sm" onClick={() => removeTpe(t)}>✕ Rejeter</button>
                  <button className="bo-btn-primary bo-btn-sm" onClick={() => approvePairing(t)}>✅ Valider l'appairage</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paiements en attente d'approbation */}
      {payouts.length > 0 && (
        <div className="bo-card">
          <div className="bo-card-header">
            <span className="bo-card-title">💸 Paiements au-dessus du seuil</span>
            <span className="text-[11px] text-t-faint">{payouts.length} en attente</span>
          </div>
          <div className="divide-y divide-bo-border">
            {payouts.map(p => (
              <div key={p.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-t-primary font-mono">{p.code}</p>
                  <p className="text-xs text-t-faint">{p.tpe.name ?? p.tpe.code} · mise {fmtXAF(p.stakeXAF)}</p>
                  <p className="text-sm font-black text-gold">Gain : {fmtXAF(p.potentialWinXAF)}</p>
                </div>
                <div className="flex gap-2">
                  <button className="bo-btn-secondary bo-btn-sm" onClick={() => rejectPayout(p)}>✕ Rejeter</button>
                  <button className="bo-btn-primary bo-btn-sm" onClick={() => approvePayout(p)}>✅ Approuver</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste des TPE */}
      {loading ? (
        <div className="bo-card p-12 text-center text-t-faint">Chargement…</div>
      ) : others.length === 0 ? (
        <div className="bo-card p-12 text-center text-t-faint">
          <div className="text-4xl mb-2">🖥️</div>
          <p>Aucun TPE actif. Les nouveaux appareils apparaissent ici après appairage.</p>
        </div>
      ) : (
        <div className="bo-card">
          <div className="bo-card-header">
            <span className="bo-card-title">Terminaux</span>
          </div>
          <div className="divide-y divide-bo-border">
            {others.map(t => (
              <div key={t.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-t-primary">{t.name ?? t.code}</p>
                    <span className={`${STATUS_BADGE[t.status]} text-[10px]`}>{STATUS_LABEL[t.status]}</span>
                  </div>
                  <p className="text-xs text-t-faint mt-0.5">{t.code} · vu {timeAgo(t.lastSeenAt)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] text-t-faint uppercase tracking-wide">Crédit</p>
                    <p className="text-sm font-black text-green-400">{fmtXAF(t.creditXAF)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="bo-btn-secondary bo-btn-sm" onClick={() => setCreditModal(t)}>💰 Crédit</button>
                    <button
                      className={`bo-btn-sm ${t.status === "BLOCKED" ? "bo-btn-primary" : "bo-btn-danger"}`}
                      onClick={() => toggleBlock(t)}
                    >
                      {t.status === "BLOCKED" ? "✅ Débloquer" : "🔴 Bloquer"}
                    </button>
                    <button className="bo-btn-danger bo-btn-sm" onClick={() => removeTpe(t)}>🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal crédit */}
      {creditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bo-card border border-bo-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-t-primary">
                💰 Ajuster le crédit — {creditModal.name ?? creditModal.code}
              </h2>
              <button onClick={() => setCreditModal(null)} className="text-t-faint hover:text-t-primary text-lg">✕</button>
            </div>
            <p className="text-xs text-t-faint mb-3">
              Solde actuel : <strong className="text-t-primary">{fmtXAF(creditModal.creditXAF)}</strong> ·
              utilisez un montant négatif pour retirer du crédit
            </p>
            <form onSubmit={submitCredit} className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Montant (XAF) *</label>
                <input className="bo-input w-full" type="number" required placeholder="Ex: 100000 ou -20000"
                  value={creditAmount} onChange={e => setCreditAmount(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Motif</label>
                <input className="bo-input w-full" placeholder="Ex: Dotation hebdomadaire"
                  value={creditReason} onChange={e => setCreditReason(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setCreditModal(null)} className="bo-btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={saving} className="bo-btn-primary flex-1">
                  {saving ? "Enregistrement…" : "Confirmer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
