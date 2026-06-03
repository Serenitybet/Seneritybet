"use client";

import { useEffect, useState } from "react";
import { formatXAF } from "@serenitybet/shared";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Cell,
} from "recharts";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

function betBadge(s: string) {
  if (s === "WON")     return <span className="bo-badge-green">Gagné</span>;
  if (s === "LOST")    return <span className="bo-badge-red">Perdu</span>;
  if (s === "PENDING") return <span className="bo-badge-blue">En cours</span>;
  if (s === "MANUAL_REVIEW") return <span className="bo-badge-orange">⚠ Revue</span>;
  return <span className="bo-badge-gray">{s}</span>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-bo-card border border-bo-border2 rounded-lg px-3 py-2 text-xs">
        <p className="text-t-faint mb-1">{label}</p>
        <p className="text-green-400 font-bold">{formatXAF(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const [stats, setStats]       = useState<any>(null);
  const [recentBets, setRecent] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("bo_token");
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API}/admin/reports/dashboard`, { headers }).then(r => r.json()).catch(() => ({})),
      fetch(`${API}/admin/bets?page=1&limit=5`, { headers }).then(r => r.json()).catch(() => ({})),
    ]).then(([dash, bets]) => {
      if (dash.success) setStats(dash.data);
      if (bets.data?.bets) setRecent(bets.data.bets);
    }).finally(() => setLoading(false));
  }, []);

  const KPIs = [
    {
      label: "Parieurs actifs",
      icon: "👥",
      color: "text-blue-400",
      value: loading ? "—" : (stats?.users?.total ?? 0).toLocaleString("fr-FR"),
      delta: stats?.users?.activeToday ? `↑ ${stats.users.activeToday} actifs aujourd'hui` : "—",
    },
    {
      label: "Dépôts du jour",
      icon: "💰",
      color: "text-green-400",
      value: loading ? "—" : formatXAF(stats?.finance?.depositsToday ?? 0),
      delta: "Aujourd'hui",
    },
    {
      label: "GGR (Revenu brut)",
      icon: "📈",
      color: "text-gold",
      value: loading ? "—" : formatXAF(stats?.finance?.grossRevenue ?? 0),
      delta: stats?.finance?.margin ? `Marge: ${stats.finance.margin}%` : "—",
    },
    {
      label: "Paris en cours",
      icon: "🎯",
      color: "text-orange-400",
      value: loading ? "—" : (stats?.bets?.pending ?? 0).toLocaleString("fr-FR"),
      delta: stats?.bets?.manualReview ? `⚠️ ${stats.bets.manualReview} en revue` : "Temps réel",
    },
  ];

  // Graphique 7 jours — données réelles si disponibles, sinon vide
  const chartData = stats?.chart ?? [
    { day: "Lun", mises: 0 }, { day: "Mar", mises: 0 }, { day: "Mer", mises: 0 },
    { day: "Jeu", mises: 0 }, { day: "Ven", mises: 0 }, { day: "Sam", mises: 0 }, { day: "Dim", mises: 0 },
  ];

  const sportsData = stats?.sportsDist ?? [];

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {KPIs.map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <div className="kpi-label"><span>{kpi.icon}</span>{kpi.label}</div>
            <div className={`kpi-value ${kpi.color}`}>{kpi.value}</div>
            <div className="kpi-delta text-t-faint">{kpi.delta}</div>
          </div>
        ))}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bo-card xl:col-span-2">
          <div className="bo-card-header">
            <span className="bo-card-title">📊 Mises par jour — 7 derniers jours</span>
          </div>
          <div className="bo-card-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={28}>
                <XAxis dataKey="day" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="mises" radius={[4,4,0,0]}>
                  {chartData.map((_: any, i: number) => (
                    <Cell key={i} fill={i === chartData.length - 1 ? "#22c55e" : "#222730"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bo-card">
          <div className="bo-card-header">
            <span className="bo-card-title">🔥 Sports populaires</span>
          </div>
          <div className="bo-card-body space-y-3">
            {sportsData.length === 0 ? (
              <p className="text-t-faint text-sm text-center py-4">Aucune donnée disponible</p>
            ) : (
              sportsData.map((s: any) => (
                <div key={s.sport}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] text-t-muted">{s.sport}</span>
                    <span className="text-[11px] text-green-400 font-bold">{s.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-bo-input rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Derniers paris */}
      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">🎯 Derniers paris</span>
          <a href="/bets" className="text-[11px] text-green-400 hover:underline">Voir tout →</a>
        </div>

        {loading && (
          <div className="p-8 text-center text-t-faint">
            <div className="w-5 h-5 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-2" />
            Chargement…
          </div>
        )}

        {!loading && recentBets.length === 0 && (
          <div className="p-8 text-center text-t-faint">
            <p>Aucun pari pour le moment.</p>
            <p className="text-xs mt-1">Les paris des joueurs apparaîtront ici.</p>
          </div>
        )}

        {!loading && recentBets.length > 0 && (
          <table className="bo-table">
            <thead>
              <tr>
                <th>Parieur</th>
                <th>Mise</th>
                <th>Cote</th>
                <th>Gain pot.</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentBets.map((bet: any) => (
                <tr key={bet.id}>
                  <td>
                    <div>
                      <p className="text-t-primary font-medium text-sm">{bet.user?.firstName} {bet.user?.lastName}</p>
                      <p className="text-t-faint text-[10px]">{bet.user?.email}</p>
                    </div>
                  </td>
                  <td className="font-mono text-t-primary">{formatXAF(Number(bet.stake))}</td>
                  <td className="text-green-400 font-bold font-mono">{Number(bet.totalOdds ?? 0).toFixed(2)}</td>
                  <td className="font-mono text-t-primary">{formatXAF(Number(bet.potentialWin))}</td>
                  <td>{betBadge(bet.status)}</td>
                  <td className="text-t-faint text-xs">{new Date(bet.createdAt).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
