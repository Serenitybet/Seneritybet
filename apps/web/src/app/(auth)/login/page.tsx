"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useWalletStore } from "@/store/wallet.store";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const { fetchBalance } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur de connexion"); return; }

      setAuth(data.data.user, data.data.accessToken);
      await fetchBalance();
      toast.success(`Bienvenue, ${data.data.user.firstName} !`);
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
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-green-600/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-green-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-green-gradient rounded-xl flex items-center justify-center font-black text-white text-lg shadow-lg shadow-green-900/50">
              S
            </div>
            <span className="font-black text-2xl tracking-tight">
              <span className="text-green-400">Serenity</span>
              <span className="text-txt-primary">bet</span>
            </span>
          </Link>
          <h1 className="text-2xl font-black text-txt-primary">Connexion</h1>
          <p className="text-txt-muted text-sm mt-1">Accédez à votre compte</p>
        </div>

        {/* Carte formulaire */}
        <div className="bg-bg-secondary border border-bg-border rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-txt-secondary mb-1.5">
                Adresse email
              </label>
              <input
                type="email"
                className="field"
                placeholder="votre@email.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                autoComplete="email"
              />
            </div>

            {/* Mot de passe */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-txt-secondary">Mot de passe</label>
                <a href="/forgot-password" className="text-xs text-green-400 hover:underline">
                  Mot de passe oublié ?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  className="field pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary transition-colors text-sm"
                >
                  {showPwd ? "👁️" : "🔒"}
                </button>
              </div>
            </div>

            {/* Bouton */}
            <button
              type="submit"
              className="btn-green w-full py-3 text-base font-bold mt-2"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connexion en cours...
                </span>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          {/* Séparateur */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-bg-border" />
            <span className="text-xs text-txt-muted">Nouveau sur Serenitybet ?</span>
            <div className="flex-1 h-px bg-bg-border" />
          </div>

          <Link
            href="/register"
            className="btn-outline w-full py-2.5 text-sm text-center block font-semibold"
          >
            Créer un compte gratuitement
          </Link>
        </div>

        {/* Mention légale */}
        <p className="text-center text-[11px] text-txt-muted mt-6">
          🔞 Jeu réservé aux +18 ans · Licence Serenitybet (Tchad)
        </p>
      </div>
    </div>
  );
}
