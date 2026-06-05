"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://seneritybet.onrender.com/api";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    password: "", confirmPassword: "",
    bio: "", socialMedia: "", promoCode: "",
  });

  const up = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [f]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { toast.error("Les mots de passe ne correspondent pas"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/partners/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur d'inscription"); return; }
      toast.success("Demande envoyée ! Nous vous contacterons sous 24h.");
      router.push("/login");
    } catch { toast.error("Erreur réseau"); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center font-black text-white">S</div>
            <span className="font-black text-xl"><span className="text-green-400">Serenity</span><span className="text-white">bet</span> Partners</span>
          </Link>
          <h1 className="text-2xl font-black text-white">Devenir partenaire</h1>
          <p className="text-gray-400 text-sm mt-1">Remplissez le formulaire — validation sous 24h</p>
        </div>

        {/* Étapes */}
        <div className="flex gap-2 mb-8">
          {[1,2].map(s => (
            <div key={s} className={`flex-1 h-1 rounded-full transition-all ${step >= s ? "bg-green-500" : "bg-gray-800"}`} />
          ))}
        </div>

        <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">

          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Prénom *</label>
                  <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:border-green-500 focus:outline-none"
                    value={form.firstName} onChange={up("firstName")} required placeholder="Cesaire" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Nom *</label>
                  <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:border-green-500 focus:outline-none"
                    value={form.lastName} onChange={up("lastName")} required placeholder="Koularambaye" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Email *</label>
                <input type="email" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:border-green-500 focus:outline-none"
                  value={form.email} onChange={up("email")} required placeholder="cesaire@email.com" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Téléphone (+235...) *</label>
                <input type="tel" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:border-green-500 focus:outline-none"
                  value={form.phone} onChange={up("phone")} required placeholder="+23592767036" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Mot de passe *</label>
                <input type="password" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:border-green-500 focus:outline-none"
                  value={form.password} onChange={up("password")} required minLength={8} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Confirmer le mot de passe *</label>
                <input type="password" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:border-green-500 focus:outline-none"
                  value={form.confirmPassword} onChange={up("confirmPassword")} required minLength={8} />
              </div>
              <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors mt-2">
                Continuer →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Qui êtes-vous ? (artiste, influenceur, sportif...)</label>
                <textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:border-green-500 focus:outline-none resize-none h-20"
                  value={form.bio} onChange={up("bio")} placeholder="Artiste tchadien, 50k followers sur Instagram..." />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Lien réseau social principal</label>
                <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:border-green-500 focus:outline-none"
                  value={form.socialMedia} onChange={up("socialMedia")} placeholder="https://instagram.com/votre_profil" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">
                  Code promo souhaité (optionnel — sera validé par l'équipe)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-mono">STAR-</span>
                  <input className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-16 pr-3 py-2.5 text-white font-mono uppercase focus:border-green-500 focus:outline-none"
                    value={form.promoCode} onChange={up("promoCode")} maxLength={10}
                    placeholder="CESAIRE" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Si vide, un code vous sera attribué automatiquement</p>
              </div>
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 border border-gray-700 text-gray-300 font-semibold py-3 rounded-xl">
                  ← Retour
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors">
                  {loading ? "Envoi..." : "Envoyer ma demande 🎉"}
                </button>
              </div>
            </>
          )}
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Déjà partenaire ?{" "}
          <Link href="/login" className="text-green-400 hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
