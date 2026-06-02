"use client";

import { useEffect, useState } from "react";
import { formatXAF } from "@serenitybet/shared";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Cell,
} from "recharts";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

/* Données simulées pour le graphique (en attendant l'API) */
const CHART_DATA = [
  { day: "Lun", mises: 142000 },
  { day: "Mar", mises: 184000 },
  { day: "Mer", mises: 128000 },
  { day: "Jeu", mises: 213000 },
  { day: "Ven", mises: 197000 },
  { day: "Sam", mises: 241000 },
  { day: "Dim", mises: 221000 },
];

const SPORTS_DIST = [
  { sport: "⚽ Football",    pct: 64, color: "bg-green-500" },
  { sport: "🏀 Basketball",  pct: 18, color: "bg-blue-500" },
  { sport: "🎾 Tennis",      pct: 10, color: "bg-orange-400" },
  { sport: "🏉 Autres",      pct: 8,  color: "bg-t-faint" },
];

const RECENT_BETS = [
  { id: "#BT-4821", user: "@mbaye_d",  match: "Real Madrid vs Bayern",   sel: "Bayern",  mise: 500,  cote: 2.80, gain: 1400,  status: "pending" },
  { id: "#BT-4820", user: "@ali_hass", match: "Cameroun vs Nigeria",     sel: "Cameroun",mise: 2000, cote: 1.72, gain: 3440,  status: "pending" },
  { id: "#BT-4819", user: "@fatou_k",  match: "PSG vs Arsenal",          sel: "Nul",     mise: 300,  cote: 3.45, gain: 1035,  status: "won" },
  { id: "#BT-4818", user: "@jean_p",   match: "Barça vs Séville",        sel: "Barça",   mise: 1000, cote: 1.45, gain: 1450,  status: "lost" },
  { id: "#BT-4817", user: "@omar_s",   match: "Inter vs Atletico",       sel: "Inter",   mise: 750,  cote: 2.05, gain: 1537,  status: "pending" },
];

function statusBadge(s: string) {
  if (s === "won")     return <span className="bo-badge-green">Gagné</span>;
  if (s === "lost")    return <span className="bo-badge-red">Perdu</span>;
  if (s === "pending") return <span className="bo-badge-blue">En cours</span>;
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
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("bo_token");
    fetch(`${API}/admin/reports/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { if (d.success) setStats(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const KPIs = [
    {
      label: "Parieurs actifs",
      icon: "👥",
      color: "text-blue-400",
      value: loading ? "—" : (stats?.users?.total ?? 0).toLocaleString("fr-FR"),
      delta: stats?.users?.activeToday ? `${stats.users.activeToday} actifs aujourd'hui` : "Chargement…",
      up: true,
    },
    {
      label: "Mises totales (mois)",
      icon: "🪙",
      color: "text-gold",
      value: loading ? "—" : formatXAF(stats?.finance?.depositsToday ?? 0),
      delta: "+12.1% vs mois dernier",
      up: true,
    },
    {
      label: "GGR (Revenu brut)",
      icon: "📈",
      color: "text-green-400",
      value: loading ? "—" : formatXAF(stats?.finance?.grossRevenue ?? 0),
      delta: `Marge: ${stats ? "10.2" : "—"}%`,
      up: true,
    },
    {
      label: "Paris en cours",
      icon: "🎯",
      color: "text-orange-400",
      value: loading ? "—" : (stats?.bets?.pending ?? 0).toLocaleString("fr-FR"),
      delta: stats?.bets?.manualReview
        ? `⚠️ ${stats.bets.manualReview} en revue risque`
        : "Temps réel",
      up: false,
    },
  ];

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {KPIs.map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <div className="kpi-label">
              <span>{kpi.icon}</span>
              {kpi.label}
            </div>
            <div className={`kpi-value ${kpi.color}`}>{kpi.value}</div>
            <div className={`kpi-delta ${kpi.up ? "text-green-400" : "text-t-faint"}`}>
              {kpi.up ? "↑" : "●"} {kpi.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Bar chart mises 7 jours */}
        <div className="bo-card xl:col-span-2">
          <div className="bo-card-header">
            <span className="bo-card-title">📊 Mises par jour — 7 derniers jours</span>
          </div>
          <div className="bo-card-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={CHART_DATA} barSize={28}>
                <XAxis dataKey="day" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="mises" radius={[4, 4, 0, 0]}>
                  {CHART_DATA.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={i === CHART_DATA.length - 1 ? "#22c55e" : "#222730"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sports populaires */}
        <div className="bo-card">
          <div className="bo-card-header">
            <span className="bo-card-title">🔥 Sports populaires</span>
          </div>
          <div className="bo-card-body space-y-3">
            {SPORTS_DIST.map((s) => (
              <div key={s.sport}>
                <div className="flex justify-between mb-1">
                  <span className="text-[11px] text-t-muted">{s.sport}</span>
                  <span className="text-[11px] text-green-400 font-bold">{s.pct}%</span>
                </div>
                <div className="h-1.5 bg-bo-input rounded-full overflow-hidden">
                  <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Derniers paris */}
      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">🎯 Derniers paris</span>
          <a href="/bets" className="text-[11px] text-green-400 hover:underline">Voir tout →</a>
        </div>
        <table className="bo-table">
          <thead>
            <tr>
              <th>Parieur</th>
              <th>Match</th>
              <th>Sélection</th>
              <th>Mise</th>
              <th>Cote</th>
              <th>Gain pot.</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {RECENT_BETS.map((bet) => (
              <tr key={bet.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center text-[10px] text-green-400 font-bold shrink-0">
                      {bet.user[1]?.toUpperCase()}
                    </div>
                    <span className="text-t-muted">{bet.user}</span>
                  </div>
                </td>
                <td className="text-t-muted">{bet.match}</td>
                <td><span className="bo-badge-yellow">{bet.sel}</span></td>
                <td className="font-mono text-t-primary">{formatXAF(bet.mise * 100)}</td>
                <td className="text-green-400 font-bold font-mono">{bet.cote.toFixed(2)}</td>
                <td className="font-mono text-t-primary">{formatXAF(bet.gain * 100)}</td>
                <td>{statusBadge(bet.status)}</td>
                <td>
                  {bet.status === "pending" && (
                    <button className="bo-btn-danger bo-btn-sm">✕ Annuler</button>
                  )}
                  {bet.status !== "pending" && (
                    <button className="bo-btn-secondary bo-btn-sm">👁 Voir</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
