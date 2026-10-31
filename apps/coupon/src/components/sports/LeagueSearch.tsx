"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Recherche par championnat — demande explicite du 31/10/2026 : jusqu'ici
// aucun moyen de filtrer/chercher les matchs par compétition, seulement par
// sport (SportNav) ou par date (DateTabs). Même approche "paramètre d'URL"
// que ces deux-là, pour que le résultat reste partageable/rafraîchissable.
export function LeagueSearch({ activeSport }: { activeSport?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("league") ?? "");

  // Si l'utilisateur change de sport/date via un autre contrôle, resynchroniser
  // le champ avec l'état réel de l'URL (ex. navigation arrière du navigateur).
  useEffect(() => {
    setValue(searchParams.get("league") ?? "");
  }, [searchParams]);

  // Débounce : éviter une requête serveur à chaque frappe.
  useEffect(() => {
    const current = searchParams.get("league") ?? "";
    if (value === current) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (activeSport) params.set("sport", activeSport);
      const date = searchParams.get("date");
      if (date) params.set("date", date);
      if (value.trim()) params.set("league", value.trim());
      router.push(`/?${params.toString()}`);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted text-sm">🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Rechercher un championnat… (ex. Premier League)"
        className="field w-full text-sm pl-8 pr-8"
      />
      {value && (
        <button
          onClick={() => setValue("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary text-sm"
          aria-label="Effacer la recherche"
        >
          ✕
        </button>
      )}
    </div>
  );
}
