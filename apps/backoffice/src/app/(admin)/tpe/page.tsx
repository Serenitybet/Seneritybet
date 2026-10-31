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
  dailyCreditXAF: number | null; // null = pas de palier journalier (recharge manuelle uniquement)
  regionId: string | null;
  region: { id: string; name: string } | null;
  lastSeenAt: string | null;
  pairedAt: string | null;
  // 0 = accès libre, tout caissier peut se connecter sur ce TPE (comportement
  // historique) — voir requireCashierAssignedToTpe côté API.
  assignedCashiersCount: number;
}

interface Cashier {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Region {
  id: string;
  name: string;
  maxWinXAF: number | null; // null = hérite du plafond global
  tpeCount: number;
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
  const [tab, setTab] = useState<"terminaux" | "regions">("terminaux");
  const [tpes, setTpes] = useState<Tpe[]>([]);
  const [payouts, setPayouts] = useState<PendingPayout[]>([]);
  const [threshold, setThreshold] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [creditModal, setCreditModal] = useState<Tpe | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [cashierModal, setCashierModal] = useState<Tpe | null>(null);
  const [assignedCashiers, setAssignedCashiers] = useState<Cashier[]>([]);
  const [allCashiers, setAllCashiers] = useState<Cashier[]>([]);
  const [cashierToAdd, setCashierToAdd] = useState("");
  const [loadingCashiers, setLoadingCashiers] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [newRegionName, setNewRegionName] = useState("");
  const [newRegionMaxWin, setNewRegionMaxWin] = useState("");
  const [savingRegion, setSavingRegion] = useState(false);

  function token() { return localStorage.getItem("bo_token"); }
  function authHeaders(extra?: Record<string, string>) {
    return { Authorization: `Bearer ${token()}`, ...extra };
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [tpeRes, payoutRes, thresholdRes, regionsRes] = await Promise.all([
        fetch(`${API}/admin/tpe`, { headers: authHeaders() }),
        fetch(`${API}/admin/tpe/payouts/pending`, { headers: authHeaders() }),
        fetch(`${API}/admin/settings/tpe-payout-threshold`, { headers: authHeaders() }),
        fetch(`${API}/admin/regions`, { headers: authHeaders() }),
      ]);
      const tpeData = await tpeRes.json();
      const payoutData = await payoutRes.json();
      const thresholdData = await thresholdRes.json();
      const regionsData = await regionsRes.json();
      if (tpeData.data) setTpes(tpeData.data);
      if (payoutData.data) setPayouts(payoutData.data);
      if (thresholdData.data) setThreshold(String(thresholdData.data.thresholdXAF));
      if (regionsData.data) setRegions(regionsData.data);
    } catch { toast.error("Erreur de chargement"); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  async function approvePairing(tpe: Tpe) {
    const name = prompt("Nom du terminal :", tpe.name ?? "");
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

  async function renameTpe(tpe: Tpe) {
    const name = prompt(`Renommer "${tpe.name ?? tpe.code}" (code ${tpe.code}) :`, tpe.name ?? "");
    if (name === null) return;
    try {
      const res = await fetch(`${API}/admin/tpe/${tpe.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: name.trim() || null }),
      });
      if (res.ok) { toast.success("Nom mis à jour ✓"); loadAll(); }
      else toast.error("Erreur");
    } catch { toast.error("Erreur réseau"); }
  }

  async function editDailyCredit(tpe: Tpe) {
    const current = tpe.dailyCreditXAF != null ? String(tpe.dailyCreditXAF) : "";
    const input = prompt(
      `Palier journalier pour "${tpe.name ?? tpe.code}" (XAF) — le crédit y est remis automatiquement chaque jour à ` +
      `minuit, à la place d'une recharge manuelle. Laisser vide pour désactiver (recharge manuelle uniquement) :`,
      current,
    );
    if (input === null) return;
    const trimmed = input.trim();
    try {
      const res = await fetch(`${API}/admin/tpe/${tpe.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ dailyCreditXAF: trimmed === "" ? null : Number(trimmed) }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success(trimmed === "" ? "Palier journalier désactivé ✓" : "Palier journalier mis à jour ✓");
      loadAll();
    } catch { toast.error("Erreur réseau"); }
  }

  async function assignRegion(tpe: Tpe, regionId: string) {
    try {
      const res = await fetch(`${API}/admin/tpe/${tpe.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ regionId: regionId || null }),
      });
      if (res.ok) { toast.success("Région mise à jour ✓"); loadAll(); }
      else toast.error("Erreur");
    } catch { toast.error("Erreur réseau"); }
  }

  async function createRegion(e: React.FormEvent) {
    e.preventDefault();
    if (!newRegionName.trim()) return;
    setSavingRegion(true);
    try {
      const res = await fetch(`${API}/admin/regions`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: newRegionName.trim(),
          maxWinXAF: newRegionMaxWin !== "" ? Number(newRegionMaxWin) : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success(`Région "${newRegionName.trim()}" créée ✓`);
      setNewRegionName(""); setNewRegionMaxWin("");
      loadAll();
    } catch { toast.error("Erreur réseau"); }
    finally { setSavingRegion(false); }
  }

  async function renameRegion(region: Region) {
    const name = prompt("Renommer la région :", region.name);
    if (name === null || !name.trim()) return;
    try {
      const res = await fetch(`${API}/admin/regions/${region.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: name.trim() }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success("Région renommée ✓");
      loadAll();
    } catch { toast.error("Erreur réseau"); }
  }

  async function editRegionMaxWin(region: Region) {
    const current = region.maxWinXAF != null ? String(region.maxWinXAF) : "";
    const input = prompt(
      `Plafond de gain pour "${region.name}" (XAF) — laisser vide pour hériter du plafond global :`,
      current,
    );
    if (input === null) return;
    const trimmed = input.trim();
    try {
      const res = await fetch(`${API}/admin/regions/${region.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ maxWinXAF: trimmed === "" ? null : Number(trimmed) }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success("Plafond mis à jour ✓");
      loadAll();
    } catch { toast.error("Erreur réseau"); }
  }

  async function deleteRegion(region: Region) {
    if (!confirm(`Supprimer la région "${region.name}" ?`)) return;
    try {
      const res = await fetch(`${API}/admin/regions/${region.id}`, { method: "DELETE", headers: authHeaders() });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success("Région supprimée ✓");
      loadAll();
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

  async function openCashierModal(tpe: Tpe) {
    setCashierModal(tpe);
    setCashierToAdd("");
    setLoadingCashiers(true);
    try {
      const [assignedRes, allRes] = await Promise.all([
        fetch(`${API}/admin/tpe/${tpe.id}/cashiers`, { headers: authHeaders() }),
        fetch(`${API}/admin/users/staff?role=CASHIER`, { headers: authHeaders() }),
      ]);
      const assignedData = await assignedRes.json();
      const allData = await allRes.json();
      setAssignedCashiers(assignedData.data ?? []);
      setAllCashiers(allData.data?.users ?? []);
    } catch { toast.error("Erreur de chargement"); }
    finally { setLoadingCashiers(false); }
  }

  async function addCashier() {
    if (!cashierModal || !cashierToAdd) return;
    try {
      const res = await fetch(`${API}/admin/tpe/${cashierModal.id}/cashiers`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ cashierId: cashierToAdd }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success("Caissier rattaché ✓");
      setCashierToAdd("");
      openCashierModal(cashierModal);
      loadAll();
    } catch { toast.error("Erreur réseau"); }
  }

  async function removeCashier(cashierId: string) {
    if (!cashierModal) return;
    try {
      const res = await fetch(`${API}/admin/tpe/${cashierModal.id}/cashiers/${cashierId}`, {
        method: "DELETE", headers: authHeaders(),
      });
      if (!res.ok) { toast.error("Erreur"); return; }
      toast.success("Caissier détaché ✓");
      openCashierModal(cashierModal);
      loadAll();
    } catch { toast.error("Erreur réseau"); }
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

      {/* Onglets */}
      <div className="flex gap-2">
        {(["terminaux", "regions"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? "bg-green-600 text-white" : "bg-bo-card text-t-muted hover:text-t-primary border border-bo-border2"}`}>
            {t === "terminaux" ? "🖥️ Terminaux" : "📍 Régions"}
          </button>
        ))}
      </div>

      {tab === "terminaux" && (<>

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

      {/* Liste des TPE, regroupée par région */}
      {loading ? (
        <div className="bo-card p-12 text-center text-t-faint">Chargement…</div>
      ) : others.length === 0 ? (
        <div className="bo-card p-12 text-center text-t-faint">
          <div className="text-4xl mb-2">🖥️</div>
          <p>Aucun TPE actif. Les nouveaux appareils apparaissent ici après appairage.</p>
        </div>
      ) : (
        [...regions.map(r => r.name), "Sans région"].map(groupName => {
          const groupTpes = others.filter(t => (t.region?.name ?? "Sans région") === groupName);
          if (groupTpes.length === 0) return null;
          return (
            <div key={groupName} className="bo-card">
              <div className="bo-card-header">
                <span className="bo-card-title">📍 {groupName}</span>
                <span className="text-[11px] text-t-faint">{groupTpes.length} terminal(aux)</span>
              </div>
              <div className="divide-y divide-bo-border">
                {groupTpes.map(t => (
                  <div key={t.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-t-primary">{t.name ?? t.code}</p>
                        <span className={`${STATUS_BADGE[t.status]} text-[10px]`}>{STATUS_LABEL[t.status]}</span>
                      </div>
                      <p className="text-xs text-t-faint mt-0.5">{t.code} · vu {timeAgo(t.lastSeenAt)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[10px] text-t-faint uppercase tracking-wide mb-0.5">Région</p>
                        <select className="bo-input text-xs py-1 w-40" value={t.regionId ?? ""}
                          onChange={e => assignRegion(t, e.target.value)}>
                          <option value="">— Sans région —</option>
                          {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-t-faint uppercase tracking-wide">Crédit</p>
                        <p className="text-sm font-black text-green-400">{fmtXAF(t.creditXAF)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-t-faint uppercase tracking-wide">Palier journalier</p>
                        <p className="text-sm font-black text-gold">
                          {t.dailyCreditXAF != null ? fmtXAF(t.dailyCreditXAF) : "Désactivé"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className="bo-btn-secondary bo-btn-sm" onClick={() => renameTpe(t)}>✏️ Renommer</button>
                        <button className="bo-btn-secondary bo-btn-sm" onClick={() => setCreditModal(t)}>💰 Crédit</button>
                        <button className="bo-btn-secondary bo-btn-sm" onClick={() => editDailyCredit(t)}>📅 Palier</button>
                        <button className="bo-btn-secondary bo-btn-sm" onClick={() => openCashierModal(t)}>
                          👤 Caissiers {t.assignedCashiersCount > 0 ? `(${t.assignedCashiersCount})` : "(libre)"}
                        </button>
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
          );
        })
      )}

      </>)}

      {tab === "regions" && (<>

      {/* Créer une région */}
      <div className="bo-card p-4">
        <p className="bo-card-title mb-3">➕ Créer une région</p>
        <form onSubmit={createRegion} className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Nom *</label>
            <input className="bo-input w-48" required placeholder="Ex: N'Djamena Centre"
              value={newRegionName} onChange={e => setNewRegionName(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Plafond de gain (XAF)</label>
            <input className="bo-input w-40" type="number" min="0" placeholder="Hérite du plafond global"
              value={newRegionMaxWin} onChange={e => setNewRegionMaxWin(e.target.value)} />
          </div>
          <button type="submit" disabled={savingRegion} className="bo-btn-primary bo-btn-sm">
            {savingRegion ? "Création…" : "Créer"}
          </button>
        </form>
        <p className="text-[11px] text-t-faint mt-2">
          Laisser le plafond vide : la région hérite du plafond global réglé sur l'onglet Terminaux.
          Un plafond propre à la région remplace ce réglage global pour tous les TPE qui lui sont rattachés.
        </p>
      </div>

      {/* Liste des régions */}
      {regions.length === 0 ? (
        <div className="bo-card p-12 text-center text-t-faint">
          <div className="text-4xl mb-2">📍</div>
          <p>Aucune région créée pour l'instant.</p>
        </div>
      ) : (
        <div className="bo-card">
          <div className="bo-card-header">
            <span className="bo-card-title">Régions</span>
          </div>
          <div className="divide-y divide-bo-border">
            {regions.map(r => (
              <div key={r.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-t-primary">{r.name}</p>
                  <p className="text-xs text-t-faint mt-0.5">{r.tpeCount} terminal(aux) rattaché(s)</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] text-t-faint uppercase tracking-wide">Plafond de gain</p>
                    <p className="text-sm font-black text-gold">
                      {r.maxWinXAF != null ? fmtXAF(r.maxWinXAF) : "Hérité (global)"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="bo-btn-secondary bo-btn-sm" onClick={() => renameRegion(r)}>✏️ Renommer</button>
                    <button className="bo-btn-secondary bo-btn-sm" onClick={() => editRegionMaxWin(r)}>⚠️ Plafond</button>
                    <button className="bo-btn-danger bo-btn-sm" onClick={() => deleteRegion(r)}>🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      </>)}

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

      {/* Modal caissiers rattachés */}
      {cashierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bo-card border border-bo-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-t-primary">
                👤 Caissiers rattachés — {cashierModal.name ?? cashierModal.code}
              </h2>
              <button onClick={() => setCashierModal(null)} className="text-t-faint hover:text-t-primary text-lg">✕</button>
            </div>

            {loadingCashiers ? (
              <p className="text-xs text-t-faint">Chargement…</p>
            ) : (
              <>
                <p className="text-xs text-t-faint mb-3">
                  {assignedCashiers.length === 0
                    ? "Aucun caissier rattaché — accès libre, n'importe quel caissier peut se connecter sur ce TPE."
                    : "Seuls les caissiers ci-dessous peuvent se connecter sur ce TPE."}
                </p>

                {assignedCashiers.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {assignedCashiers.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-2 bg-bo-surface rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-t-primary truncate">{c.firstName} {c.lastName}</p>
                          <p className="text-[11px] text-t-faint truncate">{c.email}</p>
                        </div>
                        <button onClick={() => removeCashier(c.id)} className="text-t-faint hover:text-red-400 text-sm shrink-0">
                          ✕ Détacher
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Rattacher un caissier</label>
                    <select className="bo-input w-full" value={cashierToAdd} onChange={e => setCashierToAdd(e.target.value)}>
                      <option value="">— Choisir —</option>
                      {allCashiers
                        .filter(c => !assignedCashiers.some(a => a.id === c.id))
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.email})</option>
                        ))}
                    </select>
                  </div>
                  <button className="bo-btn-primary bo-btn-sm" disabled={!cashierToAdd} onClick={addCashier}>
                    Ajouter
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
