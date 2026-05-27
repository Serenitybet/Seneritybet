"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";

export default function FavoritesPage() {
  const { user } = useAuthStore();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-bg-card border border-bg-border rounded-2xl">
        <span className="text-5xl mb-4">⭐</span>
        <h2 className="text-lg font-bold text-txt-primary mb-2">Connectez-vous pour voir vos favoris</h2>
        <p className="text-txt-muted text-sm mb-6">Sauvegardez vos compétitions et matchs préférés.</p>
        <Link href="/login" className="btn-green px-6 py-2.5 text-sm">
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-black text-txt-primary">Mes Favoris</h1>
      <div className="flex flex-col items-center justify-center py-16 text-center bg-bg-card border border-bg-border rounded-2xl">
        <span className="text-5xl mb-4">⭐</span>
        <h2 className="text-base font-bold text-txt-primary mb-2">Aucun favori pour l&apos;instant</h2>
        <p className="text-txt-muted text-sm">
          Cliquez sur ⭐ à côté d&apos;une compétition pour l&apos;ajouter ici.
        </p>
      </div>
    </div>
  );
}
