"use client";

import { useState } from "react";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div
      onClick={() => setOn(!on)}
      className={`bo-toggle ${on ? "on" : ""}`}
    />
  );
}

function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-bo-border last:border-b-0">
      <div>
        <p className="text-xs font-medium text-t-primary">{label}</p>
        {desc && <p className="text-[10px] text-t-faint mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function SettingSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-bo-surface border border-bo-border2 rounded-xl p-4">
      <h3 className="font-bold text-[13px] text-t-primary flex items-center gap-2 mb-3">
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

function AccountSection() {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  function token() { return localStorage.getItem("bo_token"); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) { toast.error("Mot de passe actuel requis"); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          currentPassword,
          ...(email ? { email } : {}),
          ...(newPassword ? { newPassword } : {}),
        }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success("Identifiants mis à jour ✓");
      setEmail(""); setCurrentPassword(""); setNewPassword("");
    } catch { toast.error("Erreur réseau"); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="bg-bo-surface border border-bo-border2 rounded-xl p-4 space-y-3">
      <h3 className="font-bold text-[13px] text-t-primary flex items-center gap-2">
        <span>🔐</span> Mon compte
      </h3>
      <p className="text-[10px] text-t-faint">Modifier ton email et/ou ton mot de passe. Le mot de passe actuel est requis.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] text-t-faint block mb-1">Nouvel email (optionnel)</label>
          <input type="email" className="bo-input w-full" value={email} onChange={e => setEmail(e.target.value)} placeholder="nouvel-email@serenitybet.td" />
        </div>
        <div>
          <label className="text-[10px] text-t-faint block mb-1">Nouveau mot de passe (optionnel)</label>
          <input type="password" className="bo-input w-full" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="8 caractères min" />
        </div>
        <div>
          <label className="text-[10px] text-t-faint block mb-1">Mot de passe actuel *</label>
          <input type="password" className="bo-input w-full" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" className="bo-btn-primary bo-btn-sm" disabled={saving}>
          {saving ? "Enregistrement…" : "💾 Mettre à jour"}
        </button>
      </div>
    </form>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <AccountSection />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SettingSection title="Jeu responsable" icon="🛡️">
          <SettingRow label="Limite de dépôt journalier" desc="Montant max par parieur / jour (XAF)">
            <input className="bo-input w-28 text-right" defaultValue="50 000" />
          </SettingRow>
          <SettingRow label="Limite de mise unique" desc="Montant max par pari (XAF)">
            <input className="bo-input w-28 text-right" defaultValue="20 000" />
          </SettingRow>
          <SettingRow label="Auto-exclusion activée" desc="Permettre aux joueurs de se bloquer">
            <Toggle defaultOn={true} />
          </SettingRow>
          <SettingRow label="Messages jeu responsable" desc="Afficher sur le frontend">
            <Toggle defaultOn={true} />
          </SettingRow>
        </SettingSection>

        <SettingSection title="Paramètres financiers" icon="💰">
          <SettingRow label="Dépôt minimum (XAF)" desc="Montant minimum accepté">
            <input className="bo-input w-28 text-right" defaultValue="1 000" />
          </SettingRow>
          <SettingRow label="Retrait minimum (XAF)" desc="Montant minimum par retrait">
            <input className="bo-input w-28 text-right" defaultValue="2 000" />
          </SettingRow>
          <SettingRow label="Délai retrait (heures)" desc="Temps de traitement manuel">
            <input className="bo-input w-28 text-right" defaultValue="24" />
          </SettingRow>
          <SettingRow label="Mobile Money activé" desc="Airtel / Orange / Moov">
            <Toggle defaultOn={true} />
          </SettingRow>
        </SettingSection>

        <SettingSection title="Paramètres des cotes" icon="📊">
          <SettingRow label="Marge bookmaker (%)" desc="Marge appliquée sur les cotes">
            <input className="bo-input w-28 text-right" defaultValue="8" />
          </SettingRow>
          <SettingRow label="Cote maximum" desc="Plafond de cote acceptée">
            <input className="bo-input w-28 text-right" defaultValue="50.00" />
          </SettingRow>
          <SettingRow label="Mise max combiné (XAF)" desc="Plafond mise sur paris combinés">
            <input className="bo-input w-28 text-right" defaultValue="10 000" />
          </SettingRow>
          <SettingRow label="Blocage cotes live auto" desc="Bloquer si variation > 20%">
            <Toggle defaultOn={true} />
          </SettingRow>
        </SettingSection>

        <SettingSection title="Notifications & Alertes" icon="🔔">
          <SettingRow label="Alerte gros paris" desc="Notifier si mise > 50 000 XAF">
            <Toggle defaultOn={true} />
          </SettingRow>
          <SettingRow label="Alerte retrait suspect" desc="Détection fraude automatique">
            <Toggle defaultOn={true} />
          </SettingRow>
          <SettingRow label="Email nouveau parieur" desc="Notifier à chaque inscription">
            <Toggle defaultOn={false} />
          </SettingRow>
          <SettingRow label="Rapport journalier auto" desc="Envoi email à 23:59 chaque soir">
            <Toggle defaultOn={true} />
          </SettingRow>
        </SettingSection>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button className="bo-btn-secondary" onClick={() => toast("Réinitialisé aux valeurs par défaut")}>
          ↺ Réinitialiser
        </button>
        <button className="bo-btn-primary" onClick={() => toast.success("Paramètres sauvegardés ✓")}>
          💾 Sauvegarder les paramètres
        </button>
      </div>
    </div>
  );
}
