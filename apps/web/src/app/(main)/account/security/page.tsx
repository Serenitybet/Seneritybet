"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export default function SecurityPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [pwdForm, setPwdForm] = useState({ current: "", next: "", confirm: "" });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  // Limites jeu responsable
  const [limits, setLimits] = useState({
    depositDaily: "",
    depositWeekly: "",
    depositMonthly: "",
    selfExclusion: "",
  });
  const [limitsLoading, setLimitsLoading] = useState(false);

  if (!user) { router.push("/login"); return null; }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwdForm.next !== pwdForm.confirm) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setPwdLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${API}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: pwdForm.current, newPassword: pwdForm.next }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
      toast.success("Mot de passe modifié ✓");
      setPwdForm({ current: "", next: "", confirm: "" });
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setPwdLoading(false);
    }
  }

  async function handleLimits(e: React.FormEvent) {
    e.preventDefault();
    setLimitsLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const payload: Record<string, number> = {};
      if (limits.depositDaily)   payload.depositDailyLimit   = parseInt(limits.depositDaily)   * 100;
      if (limits.depositWeekly)  payload.depositWeeklyLimit  = parseInt(limits.depositWeekly)  * 100;
      if (limits.depositMonthly) payload.depositMonthlyLimit = parseInt(limits.depositMonthly) * 100;
      if (limits.selfExclusion)  payload.selfExclusionDays   = parseInt(limits.selfExclusion);

      const res = await fetch(`${API}/auth/limits`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
      toast.success("Limites mises à jour ✓");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLimitsLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => router.back()}
          className="text-txt-muted hover:text-txt-primary transition-colors text-sm"
        >
          ← Retour
        </button>
        <h1 className="text-lg font-black text-txt-primary">Sécurité & Limites</h1>
      </div>

      {/* Changement de mot de passe */}
      <form onSubmit={handlePassword} className="bg-bg-secondary border border-bg-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-bg-border pb-2">
          <span className="text-lg">🔑</span>
          <h2 className="text-sm font-bold text-txt-primary">Changer le mot de passe</h2>
        </div>

        <div>
          <label className="block text-xs font-medium text-txt-secondary mb-1.5">Mot de passe actuel</label>
          <input
            type={showPwd ? "text" : "password"}
            className="field"
            value={pwdForm.current}
            onChange={(e) => setPwdForm((f) => ({ ...f, current: e.target.value }))}
            required
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-txt-secondary mb-1.5">Nouveau mot de passe</label>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              className="field pr-10"
              placeholder="8 caractères minimum"
              value={pwdForm.next}
              onChange={(e) => setPwdForm((f) => ({ ...f, next: e.target.value }))}
              minLength={8}
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary text-sm"
            >
              {showPwd ? "👁️" : "🔒"}
            </button>
          </div>
          {/* Barre de force */}
          <div className="flex gap-1 mt-1.5">
            {[4, 6, 8].map((min, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all ${
                  pwdForm.next.length >= min
                    ? i === 0 ? "bg-live" : i === 1 ? "bg-gold" : "bg-green-500"
                    : "bg-bg-border"
                }`}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-txt-secondary mb-1.5">Confirmer le nouveau mot de passe</label>
          <input
            type={showPwd ? "text" : "password"}
            className="field"
            value={pwdForm.confirm}
            onChange={(e) => setPwdForm((f) => ({ ...f, confirm: e.target.value }))}
            required
            autoComplete="new-password"
          />
          {pwdForm.confirm && pwdForm.next !== pwdForm.confirm && (
            <p className="text-[11px] text-live mt-1">Les mots de passe ne correspondent pas</p>
          )}
        </div>

        <button
          type="submit"
          className="btn-green w-full py-2.5 text-sm font-bold"
          disabled={pwdLoading}
        >
          {pwdLoading ? "Modification…" : "Modifier le mot de passe"}
        </button>
      </form>

      {/* Limites de jeu */}
      <form onSubmit={handleLimits} className="bg-bg-secondary border border-bg-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-bg-border pb-2">
          <span className="text-lg">🛡️</span>
          <h2 className="text-sm font-bold text-txt-primary">Limites de jeu responsable</h2>
        </div>

        <p className="text-xs text-txt-muted leading-relaxed">
          Définissez des plafonds de dépôt pour mieux contrôler votre budget.
          Une fois une limite réduite, la modification prend effet immédiatement.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">Limite journalière (XAF)</label>
            <input
              type="number"
              className="field"
              placeholder="ex : 10 000"
              value={limits.depositDaily}
              onChange={(e) => setLimits((l) => ({ ...l, depositDaily: e.target.value }))}
              min={1000}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">Limite hebdomadaire</label>
            <input
              type="number"
              className="field"
              placeholder="ex : 50 000"
              value={limits.depositWeekly}
              onChange={(e) => setLimits((l) => ({ ...l, depositWeekly: e.target.value }))}
              min={1000}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">Limite mensuelle</label>
            <input
              type="number"
              className="field"
              placeholder="ex : 200 000"
              value={limits.depositMonthly}
              onChange={(e) => setLimits((l) => ({ ...l, depositMonthly: e.target.value }))}
              min={1000}
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn-green w-full py-2.5 text-sm font-bold"
          disabled={limitsLoading}
        >
          {limitsLoading ? "Enregistrement…" : "Enregistrer les limites"}
        </button>
      </form>

      {/* Auto-exclusion */}
      <div className="bg-live/5 border border-live/20 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🚫</span>
          <h2 className="text-sm font-bold text-live">Auto-exclusion</h2>
        </div>
        <p className="text-xs text-txt-muted leading-relaxed">
          L'auto-exclusion bloque immédiatement l'accès à votre compte pour la durée choisie.
          Cette action est <strong className="text-txt-secondary">irrévocable</strong> pendant la période sélectionnée.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "24 heures", days: 1 },
            { label: "7 jours", days: 7 },
            { label: "30 jours", days: 30 },
            { label: "6 mois", days: 180 },
          ].map((opt) => (
            <button
              key={opt.days}
              type="button"
              onClick={() => {
                if (confirm(`Confirmer l'auto-exclusion de ${opt.label} ? Cette action est immédiate.`)) {
                  toast.error("Contactez le support pour activer l'auto-exclusion.");
                }
              }}
              className="py-2 text-xs font-semibold border border-live/30 text-live bg-live/5 hover:bg-live/10 rounded-lg transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-txt-muted">
          Pour une exclusion plus longue (1 an, 5 ans ou définitive), contactez le support :{" "}
          <a href="mailto:support@serenitybet.td" className="text-green-400 hover:underline">
            support@serenitybet.td
          </a>
        </p>
      </div>
    </div>
  );
}
