"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import toast from "react-hot-toast";

const STEPS = ["Identité", "Contact", "Sécurité"];

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({
    email: "", phone: "", password: "",
    firstName: "", lastName: "", dateOfBirth: "",
  });

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  function nextStep(e: React.FormEvent) {
    e.preventDefault();
    setStep((s) => Math.min(s + 1, 2));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur d'inscription"); return; }

      setAuth(data.data.user, data.data.accessToken);
      toast.success("🎉 Compte créé avec succès !");
      router.push("/");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4 py-10">
      {/* Fond décoratif */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-green-600/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-green-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-green-gradient rounded-xl flex items-center justify-center font-black text-white text-lg shadow-lg shadow-green-900/50">
              S
            </div>
            <span className="font-black text-2xl tracking-tight">
              <span className="text-green-400">Serenity</span>
              <span className="text-txt-primary">bet</span>
            </span>
          </Link>
          <h1 className="text-2xl font-black text-txt-primary">Créer un compte</h1>
          <p className="text-txt-muted text-sm mt-1">Rejoignez des milliers de parieurs au Tchad</p>
        </div>

        {/* Indicateur d'étapes */}
        <div className="flex items-center gap-0 mb-6">
          {STEPS.map((label, i) => (
            <div key={i} className="flex-1 flex items-center">
              <div className="flex items-center gap-1.5 flex-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all shrink-0 ${
                    i < step
                      ? "bg-green-600 border-green-600 text-white"
                      : i === step
                      ? "bg-green-600/20 border-green-600 text-green-400"
                      : "bg-bg-card border-bg-border text-txt-muted"
                  }`}
                >
                  {i < step ? "✓" : i + 1}
                </div>
                <span
                  className={`text-[11px] font-medium hidden sm:block ${
                    i === step ? "text-green-400" : i < step ? "text-txt-secondary" : "text-txt-muted"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-px flex-1 mx-1 transition-all ${
                    i < step ? "bg-green-600" : "bg-bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Carte formulaire */}
        <div className="bg-bg-secondary border border-bg-border rounded-2xl p-6 shadow-2xl">
          {/* Étape 0 — Identité */}
          {step === 0 && (
            <form onSubmit={nextStep} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-txt-secondary mb-1.5">Prénom</label>
                  <input
                    type="text"
                    className="field"
                    placeholder="Ibrahim"
                    value={form.firstName}
                    onChange={update("firstName")}
                    required
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-txt-secondary mb-1.5">Nom</label>
                  <input
                    type="text"
                    className="field"
                    placeholder="Mahamat"
                    value={form.lastName}
                    onChange={update("lastName")}
                    required
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-txt-secondary mb-1.5">
                  Date de naissance
                </label>
                <input
                  type="date"
                  className="field"
                  value={form.dateOfBirth}
                  onChange={update("dateOfBirth")}
                  max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
                  required
                />
                <p className="text-[11px] text-txt-muted mt-1">Vous devez avoir au moins 18 ans</p>
              </div>
              <button type="submit" className="btn-green w-full py-3 text-sm font-bold mt-2">
                Continuer →
              </button>
            </form>
          )}

          {/* Étape 1 — Contact */}
          {step === 1 && (
            <form onSubmit={nextStep} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-txt-secondary mb-1.5">Adresse email</label>
                <input
                  type="email"
                  className="field"
                  placeholder="votre@email.com"
                  value={form.email}
                  onChange={update("email")}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-txt-secondary mb-1.5">
                  Téléphone Mobile Money
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 bg-bg-input border border-bg-border rounded-lg text-txt-muted text-sm shrink-0">
                    🇹🇩 +235
                  </div>
                  <input
                    type="tel"
                    className="field flex-1"
                    placeholder="XX XX XX XX"
                    value={form.phone}
                    onChange={update("phone")}
                    required
                    autoComplete="tel"
                  />
                </div>
                <p className="text-[11px] text-txt-muted mt-1">
                  Airtel Money · Orange Money · Moov Money (Flooz)
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="btn-outline flex-1 py-2.5 text-sm"
                >
                  ← Retour
                </button>
                <button type="submit" className="btn-green flex-1 py-2.5 text-sm font-bold">
                  Continuer →
                </button>
              </div>
            </form>
          )}

          {/* Étape 2 — Sécurité */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-txt-secondary mb-1.5">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    className="field pr-10"
                    placeholder="8 caractères minimum"
                    value={form.password}
                    onChange={update("password")}
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary transition-colors text-sm"
                  >
                    {showPwd ? "👁️" : "🔒"}
                  </button>
                </div>
                {/* Indicateur force */}
                <div className="flex gap-1 mt-2">
                  {[4, 6, 8].map((min, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        form.password.length >= min
                          ? i === 0 ? "bg-live" : i === 1 ? "bg-gold" : "bg-green-500"
                          : "bg-bg-border"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-txt-muted mt-1">
                  {form.password.length < 4
                    ? "Trop court"
                    : form.password.length < 6
                    ? "Faible"
                    : form.password.length < 8
                    ? "Moyen"
                    : "Fort ✓"}
                </p>
              </div>

              <p className="text-xs text-txt-muted bg-bg-card border border-bg-border rounded-lg p-3 leading-relaxed">
                En vous inscrivant, vous acceptez nos{" "}
                <a href="/terms" className="text-green-400 hover:underline">CGU</a>{" "}
                et notre{" "}
                <a href="/privacy" className="text-green-400 hover:underline">Politique de confidentialité</a>.
                Vous confirmez avoir 18 ans ou plus. Le jeu peut créer une dépendance — jouez de façon responsable.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-outline flex-1 py-2.5 text-sm"
                >
                  ← Retour
                </button>
                <button
                  type="submit"
                  className="btn-green flex-1 py-2.5 text-sm font-bold"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Création...
                    </span>
                  ) : (
                    "Créer mon compte 🎉"
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Lien connexion */}
          <div className="mt-5 pt-4 border-t border-bg-border text-center">
            <span className="text-sm text-txt-muted">Déjà inscrit ? </span>
            <Link href="/login" className="text-sm text-green-400 font-semibold hover:underline">
              Se connecter
            </Link>
          </div>
        </div>

        {/* Mention légale */}
        <p className="text-center text-[11px] text-txt-muted mt-6">
          🔞 Jeu réservé aux +18 ans · Licence Serenitybet (Tchad) · Jeu responsable
        </p>
      </div>
    </div>
  );
}
