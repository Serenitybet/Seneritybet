"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { formatXAF } from "@serenitybet/shared";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

function statusBadge(s: string) {
  const map: Record<string, string> = {
    PENDING: "badge-upcoming",
    WON: "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-green-600/20 text-green-400",
    LOST: "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-live/10 text-live",
    CANCELLED: "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-bg-hover text-txt-muted",
  };
  const label: Record<string, string> = {
    PENDING: "En cours", WON: "Gagné", LOST: "Perdu", CANCELLED: "Annulé",
  };
  return <span className={map[s] ?? "badge-upcoming"}>{label[s] ?? s}</span>;
}

export default function MyBetsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    const token = localStorage.getItem("accessToken");
    fetch(`${API}/bets/my?limit=30`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.data) setBets(d.data.bets ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  const filtered = filter === "ALL" ? bets : bets.filter(b => b.status === filter);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-lg font-black text-txt-primary">Mes Paris</h1>

      {/* Filtres */}
      <div className="flex gap-2">
        {["ALL","PENDING","WON","LOST"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              filter === f
                ? "bg-green-600/20 border-green-600/40 text-green-400"
                : "bg-bg-card border-bg-border text-txt-muted hover:text-txt-primary"
            }`}
          >
            {f === "ALL" ? "Tous" : f === "PENDING" ? "En cours" : f === "WON" ? "Gagnés" : "Perdus"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="bg-bg-card border border-bg-border rounded-xl p-4 animate-pulse">
              <div className="h-3 bg-bg-hover rounded w-1/3 mb-2" />
              <div className="h-4 bg-bg-hover rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-bg-card border border-bg-border rounded-2xl">
          <span className="text-4xl mb-3">🎯</span>
          <p className="text-txt-primary font-semibold mb-1">Aucun pari trouvé</p>
          <p className="text-txt-muted text-sm">Vos paris apparaîtront ici.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((bet: any) => (
            <div key={bet.id} className="bg-bg-card border border-bg-border rounded-xl p-4 hover:bg-bg-hover transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs text-txt-muted mb-0.5">
                    {bet.type === "ACCUMULATOR" ? "Paris combiné" : "Paris simple"} · {new Date(bet.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                  <div className="flex items-center gap-2">
                    {statusBadge(bet.status)}
                    <span className="text-xs text-txt-muted">Cote : <strong className="text-gold">{Number(bet.totalOdds).toFixed(2)}</strong></span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-txt-muted">Mise</p>
                  <p className="text-sm font-bold text-txt-primary">{formatXAF(Number(bet.stake))}</p>
                </div>
              </div>

              {/* Sélections */}
              {bet.items?.map((item: any) => (
                <div key={item.id} className="mt-2 pt-2 border-t border-bg-border">
                  <p className="text-xs font-semibold text-txt-primary">
                    {item.market?.event?.homeTeam} — {item.market?.event?.awayTeam}
                  </p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[11px] text-green-400 bg-green-600/10 px-1.5 py-0.5 rounded border border-green-600/20">
                      {item.odd?.label ?? item.oddLabel}
                    </span>
                    <span className="text-[11px] text-txt-muted font-mono">{Number(item.oddValue).toFixed(2)}</span>
                  </div>
                </div>
              ))}

              {/* Gain */}
              {bet.status === "WON" && (
                <div className="mt-2 pt-2 border-t border-green-600/20 flex justify-between">
                  <span className="text-xs text-green-400 font-semibold">Gain versé</span>
                  <span className="text-sm font-black text-green-400">{formatXAF(Number(bet.potentialWin))}</span>
                </div>
              )}
              {bet.status === "PENDING" && (
                <div className="mt-2 pt-2 border-t border-bg-border flex justify-between">
                  <span className="text-xs text-txt-muted">Gain potentiel</span>
                  <span className="text-sm font-black text-gold">{formatXAF(Number(bet.potentialWin))}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
