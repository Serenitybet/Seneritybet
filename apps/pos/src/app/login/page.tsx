"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { api, setAuthToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, token } = useAuthStore();
  // Le champ s'appelle "email" côté API (identifiant générique — voir
  // auth.service.ts login(), qui reconnaît aussi le code caissier, le
  // téléphone, le numéro de joueur), mais c'est le code caissier qui est
  // saisi ici, plus l'email (demande explicite du 31/10/2026 : la connexion
  // sur un TPE ne doit plus se faire par adresse email).
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) router.replace("/");
  }, [token, router]);

  // Message laissé par l'intercepteur Axios si une session a été coupée en
  // cours de route parce que le rattachement caissier↔TPE a été retiré
  // (voir api.ts) — affiché une fois puis effacé.
  useEffect(() => {
    try {
      const msg = sessionStorage.getItem("pos-login-error");
      if (msg) {
        toast.error(msg);
        sessionStorage.removeItem("pos-login-error");
      }
    } catch { /* ignore */ }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email: code, password });
      const { accessToken, user } = res.data.data;

      const allowedRoles = ["CASHIER", "ADMIN", "SUPER_ADMIN"];
      if (!allowedRoles.includes(user.role)) {
        toast.error("Accès refusé — compte non autorisé pour la caisse");
        setLoading(false);
        return;
      }

      // Vérifie tout de suite que ce caissier est bien rattaché au TPE de cet
      // appareil (GET /tpe/me passe par requireCashierAssignedToTpe) — pour
      // un refus clair au moment de la connexion plutôt qu'au milieu d'une
      // vente, un TPE sans aucun caissier rattaché reste en accès libre.
      if (user.role === "CASHIER") {
        setAuthToken(accessToken);
        try {
          await api.get("/tpe/me");
        } catch (err: unknown) {
          setAuthToken(null);
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
          toast.error(msg ?? "Ce caissier n'est pas autorisé sur ce TPE");
          setLoading(false);
          return;
        }
      } else {
        setAuthToken(accessToken);
      }

      setAuth(accessToken, {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      });
      router.replace("/");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center p-4">
      <Toaster />
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-2xl mb-4">
            <span className="text-3xl">💰</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Serenitybet</h1>
          <p className="text-gray-500 mt-1">Caisse — Salle de jeux</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Code caissier
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              autoCapitalize="characters"
              placeholder="Ex: MARIE1"
              className="w-full px-4 py-3 text-lg font-mono uppercase border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-green-600 hover:bg-green-700 text-white text-lg font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
