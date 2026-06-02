"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthAdminStore } from "@/store/auth-admin.store";
import toast from "react-hot-toast";

export default function BoLoginPage() {
  const router = useRouter();
  const { setAdmin } = useAuthAdminStore();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api"}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Accès refusé"); return; }

      const role = data.data.user.role;
      if (!["ADMIN", "SUPER_ADMIN", "TRADER", "FINANCE"].includes(role)) {
        toast.error("Accès backoffice non autorisé"); return;
      }

      setAdmin(data.data.user, data.data.accessToken);
      toast.success(`Bienvenue, ${data.data.user.firstName} ✓`);
      router.push("/dashboard");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bo-base flex items-center justify-center px-4">
      {/* Fond décoratif */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-green-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-green-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-grd rounded-xl flex items-center justify-center font-black text-white text-lg shadow-lg shadow-green-900/50">
              S
            </div>
            <div className="text-left">
              <p className="font-black text-xl text-t-primary leading-tight">
                <span className="text-green-400">Serenity</span>bet
              </p>
              <p className="text-[10px] text-t-faint uppercase tracking-widest">Backoffice Admin</p>
            </div>
          </div>
          <p className="text-xs text-t-faint">Accès réservé au personnel autorisé</p>
        </div>

        {/* Formulaire */}
        <div className="bg-bo-card border border-bo-border rounded-2xl p-6 shadow-2xl shadow-black/40">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">
                Adresse email
              </label>
              <input
                type="email"
                className="bo-input w-full"
                placeholder="admin@serenitybet.td"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  className="bo-input w-full pr-9"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-t-faint hover:text-t-primary transition-colors text-xs"
                >
                  {showPwd ? "👁" : "🔒"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bo-btn-primary w-full justify-center py-2.5 text-sm font-bold mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connexion…
                </span>
              ) : "Accéder au backoffice"}
            </button>
          </form>

          {/* Compte démo */}
          <div className="mt-5 pt-4 border-t border-bo-border">
            <p className="text-[10px] text-t-faint text-center mb-2">Comptes de démonstration :</p>
            <div className="space-y-1.5">
              {[
                { label: "Admin",  email: "admin@serenitybet.td",  pwd: "Admin@2024!" },
                { label: "Trader", email: "trader@serenitybet.td", pwd: "Trader@2024!" },
              ].map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => setForm({ email: acc.email, password: acc.pwd })}
                  className="w-full flex items-center justify-between bg-bo-surface border border-bo-border2 rounded-lg px-3 py-2 hover:border-green-500/50 transition-all group"
                >
                  <span className="text-[10px] font-bold text-t-muted group-hover:text-t-primary">{acc.label}</span>
                  <span className="text-[10px] text-t-faint font-mono">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-t-faint mt-6">
          🔐 Connexion sécurisée — Serenitybet Backoffice v1.0
        </p>
      </div>
    </div>
  );
}
