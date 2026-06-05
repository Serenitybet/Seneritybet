"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://seneritybet.onrender.com/api";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/partners/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Identifiants incorrects"); return; }
      localStorage.setItem("partner_token", data.data.token);
      localStorage.setItem("partner", JSON.stringify(data.data.partner));
      toast.success(`Bienvenue ${data.data.partner.firstName} !`);
      router.push("/dashboard");
    } catch { toast.error("Erreur réseau"); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center font-black text-white">S</div>
            <span className="font-black text-xl"><span className="text-green-400">Serenity</span><span className="text-white">bet</span> Partners</span>
          </Link>
          <h1 className="text-2xl font-black text-white">Connexion partenaire</h1>
        </div>

        <form onSubmit={handleLogin} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Email</label>
            <input type="email" required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-white focus:border-green-500 focus:outline-none"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Mot de passe</label>
            <input type="password" required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-white focus:border-green-500 focus:outline-none"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors">
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Pas encore partenaire ?{" "}
          <Link href="/register" className="text-green-400 hover:underline">Rejoindre le programme</Link>
        </p>
      </div>
    </div>
  );
}
