"use client";

import { useRouter, useSearchParams } from "next/navigation";

const DATES = [
  { key: "today",    label: "Aujourd'hui" },
  { key: "tomorrow", label: "Demain" },
  { key: "3days",    label: "3 jours" },
  { key: "week",     label: "14 jours" },
  { key: "all",      label: "Tout" },
];

export function DateTabs({ activeSport }: { activeSport?: string }) {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const activeDate  = searchParams.get("date") ?? "all";
  // Date précise choisie via le calendrier (format YYYY-MM-DD) — distincte
  // des clés prédéfinies ci-dessus, demande explicite du 31/10/2026.
  const isCustomDate = /^\d{4}-\d{2}-\d{2}$/.test(activeDate);

  function navigate(dateKey: string) {
    const params = new URLSearchParams();
    if (activeSport) params.set("sport", activeSport);
    if (dateKey !== "all") params.set("date", dateKey);
    router.push(`/?${params.toString()}`);
  }

  // Évite le décalage de fuseau de `new Date("YYYY-MM-DD")` (interprétée en
  // UTC minuit) pour l'affichage du libellé "10 nov." dans l'onglet actif.
  function formatCustomDate(iso: string) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }

  return (
    <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-none">
      {DATES.map((d) => (
        <button
          key={d.key}
          onClick={() => navigate(d.key)}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
            activeDate === d.key && !isCustomDate
              ? "bg-green-600 text-white border-green-600"
              : "bg-bg-card text-txt-muted border-bg-border hover:text-txt-primary hover:border-green-600/40"
          }`}
        >
          {d.label}
        </button>
      ))}

      <label
        className={`relative shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
          isCustomDate
            ? "bg-green-600 text-white border-green-600"
            : "bg-bg-card text-txt-muted border-bg-border hover:text-txt-primary hover:border-green-600/40"
        }`}
      >
        <span>📅</span>
        <span>{isCustomDate ? formatCustomDate(activeDate) : "Date précise"}</span>
        {/* Champ natif superposé et transparent (plutôt que caché) pour que
            le clic ouvre bien le sélecteur de date du navigateur/mobile. */}
        <input
          type="date"
          value={isCustomDate ? activeDate : ""}
          onChange={(e) => {
            // Le champ natif peut émettre une valeur vide pendant la saisie
            // (avant qu'une date complète soit entrée) — l'ignorer plutôt
            // que de réinitialiser silencieusement le filtre.
            if (e.target.value) navigate(e.target.value);
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Choisir une date précise"
        />
      </label>
    </div>
  );
}
