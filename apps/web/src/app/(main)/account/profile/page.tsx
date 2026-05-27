"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export default function ProfilePage() {
  const router = useRouter();
  const { user, setAuth } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    phone: user?.phone ?? "",
    dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : "",
  });

  if (!user) { router.push("/login"); return null; }

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${API}/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur de mise à jour"); return; }
      setAuth(data.data.user, token!);
      toast.success("Profil mis à jour ✓");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
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
        <h1 className="text-lg font-black text-txt-primary">Mes informations</h1>
      </div>

      {/* Avatar */}
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-5 flex items-center gap-4">
        <div className="w-16 h-16 bg-green-600/20 border-2 border-green-600/30 rounded-full flex items-center justify-center shrink-0">
          <span className="text-2xl font-black text-green-400">
            {user.firstName[0].toUpperCase()}
          </span>
        </div>
        <div>
          <p className="font-bold text-txt-primary">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-sm text-txt-muted">{user.email}</p>
          <span
            className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
              user.kycStatus === "VERIFIED"
                ? "bg-green-600/20 text-green-400"
                : user.kycStatus === "PENDING"
                ? "bg-gold/20 text-gold"
                : "bg-bg-hover text-txt-muted"
            }`}
          >
            {user.kycStatus === "VERIFIED" ? "✓ KYC Vérifié" : user.kycStatus === "PENDING" ? "⏳ KYC en attente" : "KYC non vérifié"}
          </span>
        </div>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="bg-bg-secondary border border-bg-border rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-txt-primary border-b border-bg-border pb-2">
          Informations personnelles
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">Prénom</label>
            <input
              type="text"
              className="field"
              value={form.firstName}
              onChange={update("firstName")}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">Nom</label>
            <input
              type="text"
              className="field"
              value={form.lastName}
              onChange={update("lastName")}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-txt-secondary mb-1.5">Adresse email</label>
          <input
            type="email"
            className="field opacity-60 cursor-not-allowed"
            value={user.email}
            readOnly
          />
          <p className="text-[11px] text-txt-muted mt-1">L'email ne peut pas être modifié.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-txt-secondary mb-1.5">Téléphone</label>
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
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-txt-secondary mb-1.5">Date de naissance</label>
          <input
            type="date"
            className="field"
            value={form.dateOfBirth}
            onChange={update("dateOfBirth")}
          />
        </div>

        <button
          type="submit"
          className="btn-green w-full py-2.5 text-sm font-bold"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Enregistrement…
            </span>
          ) : (
            "Enregistrer les modifications"
          )}
        </button>
      </form>

      {/* KYC info */}
      {user.kycStatus !== "VERIFIED" && (
        <div className="bg-gold/5 border border-gold/20 rounded-xl p-4 flex gap-3">
          <span className="text-xl shrink-0">📋</span>
          <div>
            <p className="text-sm font-semibold text-gold mb-0.5">Vérifiez votre identité (KYC)</p>
            <p className="text-xs text-txt-muted leading-relaxed">
              Pour activer les retraits, veuillez soumettre une pièce d'identité valide (CNI ou passeport).
              Contactez le support pour démarrer la procédure.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
