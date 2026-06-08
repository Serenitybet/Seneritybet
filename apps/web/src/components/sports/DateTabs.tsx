"use client";

import { useRouter, useSearchParams } from "next/navigation";

const DATES = [
  { key: "today",    label: "Aujourd'hui" },
  { key: "tomorrow", label: "Demain" },
  { key: "3days",    label: "3 jours" },
  { key: "all",      label: "Tout" },
];

export function DateTabs({ activeSport }: { activeSport?: string }) {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const activeDate  = searchParams.get("date") ?? "all";

  function navigate(dateKey: string) {
    const params = new URLSearchParams();
    if (activeSport) params.set("sport", activeSport);
    if (dateKey !== "all") params.set("date", dateKey);
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-none">
      {DATES.map((d) => (
        <button
          key={d.key}
          onClick={() => navigate(d.key)}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
            activeDate === d.key
              ? "bg-green-600 text-white border-green-600"
              : "bg-bg-card text-txt-muted border-bg-border hover:text-txt-primary hover:border-green-600/40"
          }`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
