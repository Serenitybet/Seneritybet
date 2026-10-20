"use client";

import { useEffect, useState } from "react";
import { formatXAF } from "@serenitybet/shared";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Cell,
} from "recharts";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

function ticketBadge(s: string) {
  if (s === "WON")       return <span className="bo-badge-green">Gagné</span>;
  if (s === "PAID")      return <span className="bo-badge-green">Payé</span>;
  if (s === "LOST")      return <span className="bo-badge-red">Perdu</span>;
  if (s === "PENDING")   return <span className="bo-badge-blue">En cours</span>;
  if (s === "CANCELLED") return <span className="bo-badge-gray">Annulé</span>;
  if (s === "REFUNDED")  return <span className="bo-badge-orange">Remboursé</span>;
  return <span className="bo-badge-gray">{s}</span>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-bo-card border border-bo-border2 rounded-lg px-3 py-2 text-xs">
        <p className="text-t-faint mb-1">{label}</p>
        <p className="text-green-400 font-bold">{Number(payload[0].value).toLocaleString("fr-FR")} FCFA</p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const [stats, setStats]           = useState<any>(null);
  const [recentTickets, setRecent]  = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("bo_token");
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API}/admin/reports/dashboard`, { headers }).then(r => r.json()).catch(() => ({})),
      fetch(`${API}/admin/tickets?page=1&limit=5`, { headers }).then(r => r.json()).catch(() => ({})),
    ]).then(([dash, tickets]) => {
      if (dash.success) setStats(dash.data);
      if (tickets.data?.tickets) setRecent(tickets.data.tickets);
    }).finally(() => setLoading(false));
  }, []);

  const KPIs = [
    {
      label: "Tickets aujourd'hui",
      icon: "🎫",
      color: "text-blue-400",
      value: loading ? "—" : (stats?.tickets?.today ?? 0).toLocaleString("fr-FR"),
      delta: stats?.tickets?.pending ? `${stats.tickets.pending} en attente` : "Temps réel",
    },
    {
      label: "Mises du jour",
      icon: "💰",
      color: "text-green-400",
      value: loading ? "—" : formatXAF(stats?.finance?.stakesToday ?? 0),
      delta: "Aujourd'hui",
    },
    {
      label: "GGR TPE (jour)",
      icon: "📈",
      color: "text-gold",
      value: loading ? "—" : formatXAF(stats?.finance?.ggrToday ?? 0),
      delta: stats?.finance?.marginPct !== undefined ? `Marge: ${stats.finance.marginPct}%` : "—",
    },
    {
      label: "Crédit TPE en circulation",
      icon: "🖥",
      color: "text-orange-400",
      value: loading ? "—" : formatXAF(stats?.tpe?.totalCredit ?? 0),
      delta: stats?.tpe?.activeCount !== undefined ? `${stats.tpe.activeCount} terminaux actifs` : "—",
    },
  ];

  // Graphique 7 jours — données réelles si disponibles, sinon vide
  const chartData = stats?.chart ?? [
    { day: "Lun", stakesXAF: 0 }, { day: "Mar", stakesXAF: 0 }, { day: "Mer", stakesXAF: 0 },
    { day: "Jeu", stakesXAF: 0 }, { day: "Ven", stakesXAF: 0 }, { day: "Sam", stakesXAF: 0 }, { day: "Dim", stakesXAF: 0 },
  ];

  const topTpe = stats?.tpe?.topTpe ?? [];
  const maxTpeCount = topTpe.length > 0 ? Math.max(...topTpe.map((t: any) => t.ticketCount)) : 0;

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
            <span className="bo-card-title">📊 Mises TPE par jour — 7 derniers jours</span>
          </div>
          <div className="bo-card-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={28}>
                <XAxis dataKey="day" tick={{ fill: "#5b6168", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fill: "#5b6168", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="stakesXAF" radius={[4,4,0,0]}>
                  {chartData.map((_: any, i: number) => (
                    <Cell key={i} fill={i === chartData.length - 1 ? "#e0a812" : "#d1d5db"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bo-card">
          <div className="bo-card-header">
            <span className="bo-card-title">🔥 TPE les plus actifs</span>
          </div>
          <div className="bo-card-body space-y-3">
            {topTpe.length === 0 ? (
              <p className="text-t-faint text-sm text-center py-4">Aucune donnée disponible</p>
            ) : (
              topTpe.map((t: any) => {
                const pct = maxTpeCount > 0 ? Math.round((t.ticketCount / maxTpeCount) * 100) : 0;
                return (
                  <div key={t.code}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[11px] text-t-muted truncate">{t.name || t.code}</span>
                      <span className="text-[11px] text-green-400 font-bold">{t.ticketCount}</span>
                    </div>
                    <div className="h-1.5 bg-bo-input rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Derniers tickets */}
      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">🎫 Derniers tickets</span>
          <a href="/tpe-tickets" className="text-[11px] text-green-400 hover:underline">Voir tout →</a>
        </div>

        {loading && (
          <div className="p-8 text-center text-t-faint">
            <div className="w-5 h-5 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-2" />
            Chargement…
          </div>
        )}

        {!loading && recentTickets.length === 0 && (
          <div className="p-8 text-center text-t-faint">
            <p>Aucun ticket pour le moment.</p>
            <p className="text-xs mt-1">Les tickets émis par les TPE apparaîtront ici.</p>
          </div>
        )}

        {!loading && recentTickets.length > 0 && (
          <table className="bo-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>TPE</th>
                <th>Caissier</th>
                <th>Mise</th>
                <th>Cote</th>
                <th>Gain pot.</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentTickets.map((t: any) => (
                <tr key={t.id}>
                  <td className="font-mono text-t-primary">{t.code}</td>
                  <td>
                    <p className="text-t-primary text-sm">{t.tpe?.name || t.tpe?.code || "—"}</p>
                  </td>
                  <td className="text-t-faint text-xs">{t.cashier ? `${t.cashier.firstName} ${t.cashier.lastName}` : "—"}</td>
                  <td className="font-mono text-t-primary">{formatXAF(Number(t.stakeXAF) * 100)}</td>
                  <td className="text-green-400 font-bold font-mono">{Number(t.totalOdds ?? 0).toFixed(2)}</td>
                  <td className="font-mono text-t-primary">{formatXAF(Number(t.potentialWinXAF) * 100)}</td>
                  <td>{ticketBadge(t.status)}</td>
                  <td className="text-t-faint text-xs">{new Date(t.createdAt).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
