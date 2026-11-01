"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { COUNTRY_FLAG, competitionPriority } from "@/lib/leagueDisplay";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

interface CompetitionOption {
  id: string;
  name: string;
  country: string | null;
}

// Menu déroulant des championnats — demande explicite du 01/11/2026 : un
// simple champ de saisie libre (voir historique de ce fichier) n'offrait
// aucun moyen de voir la liste des championnats disponibles, il fallait
// deviner/connaître le nom exact à taper. Limité aux championnats ayant
// réellement un match à venir (voir GET /sports/competitions) pour qu'aucune
// option ne mène à une liste vide. Même approche "paramètre d'URL" que
// SportNav/DateTabs, pour que le résultat reste partageable/rafraîchissable.
export function LeagueSearch({ activeSport }: { activeSport?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("league") ?? "";
  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Dépend du sport actif : changer d'onglet de sport (SportNav) recharge la
  // liste pour ne proposer que les championnats de ce sport.
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeSport) params.set("sport", activeSport);
    fetch(`${API_URL}/sports/competitions?${params}`)
      .then((r) => r.json())
      .then((json) => {
        const data: CompetitionOption[] = json.data ?? [];
        // Grands championnats d'abord (même ordre que la page d'accueil,
        // voir lib/leagueDisplay.ts) — tri stable : les autres gardent
        // l'ordre alphabétique déjà renvoyé par l'API.
        setCompetitions([...data].sort((a, b) => competitionPriority(a.name) - competitionPriority(b.name)));
      })
      .catch(() => setCompetitions([]))
      .finally(() => setLoading(false));
  }, [activeSport]);

  function navigate(league: string) {
    const params = new URLSearchParams();
    if (activeSport) params.set("sport", activeSport);
    const date = searchParams.get("date");
    if (date) params.set("date", date);
    if (league) params.set("league", league);
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted text-sm">🏆</span>
      {/* Majuscules + drapeau devant chaque championnat — demande explicite
          du 01/11/2026, sur le modèle d'un concurrent (Pariez Cash). Le
          "uppercase" ne porte que sur l'affichage (CSS) : la valeur envoyée
          au serveur reste le nom exact tel qu'enregistré en base. */}
      <select
        value={competitions.some((c) => c.name === selected) ? selected : ""}
        onChange={(e) => navigate(e.target.value)}
        disabled={loading}
        className="field w-full text-sm pl-8 pr-8 appearance-none uppercase disabled:opacity-60"
      >
        <option value="">{loading ? "Chargement des championnats…" : "🌐 Tous les championnats"}</option>
        {competitions.map((c) => (
          <option key={c.id} value={c.name}>
            {c.country ? COUNTRY_FLAG[c.country] ?? "🌐" : "🌐"} {c.name}{c.country ? ` — ${c.country}` : ""}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted text-xs">▼</span>
    </div>
  );
}
