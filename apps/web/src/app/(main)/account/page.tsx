"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { useWalletStore } from "@/store/wallet.store";
import { formatXAF } from "@serenitybet/shared";

export default function AccountPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { balance, fetchBalance } = useWalletStore();

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetchBalance();
  }, [user]);

  if (!user) return null;

  const MENU = [
    { icon: "💰", label: "Portefeuille",     sub: "Dépôts, retraits, historique",  href: "/account/wallet" },
    { icon: "🎯", label: "Mes paris",         sub: "Historique de tous vos paris",  href: "/account/bets" },
    { icon: "👤", label: "Mes informations",  sub: "Nom, email, téléphone",         href: "/account/profile" },
    { icon: "🛡️", label: "Sécurité",          sub: "Mot de passe, 2FA",             href: "/account/security" },
    { icon: "🔞", label: "Jeu responsable",   sub: "Limites, exclusion",            href: "/responsible-gaming" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Carte profil */}
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-green-600/20 border border-green-600/30 rounded-full flex items-center justify-center">
            <span className="text-2xl font-black text-green-400">
              {user.firstName[0].toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-lg font-black text-txt-primary">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-sm text-txt-muted">{user.email}</p>
          </div>
        </div>

        {/* Solde */}
        <div className="bg-bg-card border border-bg-border rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-600/20 rounded-full flex items-center justify-center">
                <span className="text-green-400 text-sm font-black">₣</span>
              </div>
              <div>
                <p className="text-xs text-txt-muted">Solde disponible</p>
                <p className="text-xl font-black text-green-400">{formatXAF(balance)}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/account/wallet?tab=deposit"
              className="flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors"
            >
              ⬆️ Dépôt
            </Link>
            <Link
              href="/account/wallet?tab=withdraw"
              className="flex items-center justify-center gap-1.5 py-2 bg-bg-secondary hover:bg-bg-hover border border-bg-border text-txt-primary text-xs font-bold rounded-lg transition-colors"
            >
              💸 Retrait espèces
            </Link>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="bg-bg-secondary border border-bg-border rounded-2xl overflow-hidden divide-y divide-bg-border">
        {MENU.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-bg-hover transition-colors"
          >
            <span className="text-xl w-8 text-center">{item.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-txt-primary">{item.label}</p>
              <p className="text-xs text-txt-muted">{item.sub}</p>
            </div>
            <span className="text-txt-muted text-sm">›</span>
          </Link>
        ))}
      </div>

      {/* Déconnexion */}
      <button
        onClick={() => { logout(); router.push("/"); }}
        className="w-full py-3 text-sm text-live border border-live/20 bg-live/5 hover:bg-live/10 rounded-xl transition-colors font-semibold"
      >
        Se déconnecter
      </button>
    </div>
  );
}
