"use client";

import { useEffect, useState } from "react";
import { formatXAF } from "@serenitybet/shared";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

const DEMO_TRANSACTIONS = [
  { id: "#TX-9182", user: "@ali_hass",  type: "DEPOSIT",    amount:  50000, method: "Airtel Money",  status: "COMPLETED", date: "14:21" },
  { id: "#TX-9181", user: "@mbaye_d",   type: "WITHDRAWAL", amount: -20000, method: "Orange Money",  status: "PENDING",   date: "14:10" },
  { id: "#TX-9180", user: "@fatou_k",   type: "DEPOSIT",    amount:  10000, method: "Moov Money",    status: "COMPLETED", date: "13:55" },
  { id: "#TX-9179", user: "@jean_p",    type: "WITHDRAWAL", amount:  -5000, method: "Airtel Money",  status: "FAILED",    date: "13:30" },
  { id: "#TX-9178", user: "@omar_s",    type: "DEPOSIT",    amount: 100000, method: "Airtel Money",  status: "COMPLETED", date: "12:44" },
  { id: "#TX-9177", user: "@aisha_m",   type: "BET_WON",    amount:  48750, method: "Portefeuille",  status: "COMPLETED", date: "12:22" },
  { id: "#TX-9176", user: "@hassan_b",  type: "DEPOSIT",    amount: 200000, method: "Orange Money",  status: "COMPLETED", date: "11:15" },
];

function txTypeBadge(t: string) {
  if (t === "DEPOSIT")    return <span className="bo-badge-green">Dépôt</span>;
  if (t === "WITHDRAWAL") return <span className="bo-badge-red">Retrait</span>;
  if (t === "BET_WON")    return <span className="bo-badge-blue">Gain</span>;
  if (t === "BET_PLACED") return <span className="bo-badge-orange">Mise</span>;
  return <span className="bo-badge-gray">{t}</span>;
}

function txStatusBadge(s: string) {
  if (s === "COMPLETED") return <span className="bo-badge-green">Confirmé</span>;
  if (s === "PENDING")   return <span className="bo-badge-orange">En cours</span>;
  if (s === "FAILED")    return <span className="bo-badge-red">Échoué</span>;
  return <span className="bo-badge-gray">{s}</span>;
}

export default function ReportsPage() {
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to,   setTo]   = useState(new Date().toISOString().slice(0, 10));
  const [apiData, setApiData] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("bo_token");
    fetch(`${API}/admin/reports/financial?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { if (d.data?.transactions?.length) setApiData(d.data.transactions); })
      .catch(() => {});
  }, []);

  const summaries = [
    {
      label: "Dépôts du mois",
      value: formatXAF(20677400),
      sub: "+14.2% vs mois dernier",
      accent: "border-green-500",
      icon: "↑",
      color: "text-green-400",
    },
    {
      label: "GGR (Revenu brut jeux)",
      value: formatXAF(2215400),
      sub: "Marge moyenne : 10.2%",
      accent: "border-blue-500",
      icon: "📈",
      color: "text-blue-400",
    },
    {
      label: "Retraits du mois",
      value: formatXAF(18462000),
      sub: "347 transactions",
      accent: "border-red-500",
      icon: "↓",
      color: "text-red-400",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Cartes sommaire */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaries.map((s) => (
          <div key={s.label} className={`bg-bo-surface border-l-4 ${s.accent} border border-bo-border2 rounded-xl p-4`}>
            <p className="text-[10px] uppercase tracking-widest text-t-faint mb-2">{s.label}</p>
            <p className={`font-black text-2xl ${s.color} leading-none mb-1`}>{s.value}</p>
            <p className="text-[10px] text-t-faint">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filtre date */}
      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">📅 Filtrer par période</span>
        </div>
        <div className="bo-card-body">
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Du</label>
              <input type="date" className="bo-input w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Au</label>
              <input type="date" className="bo-input w-40" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <button className="bo-btn-primary" onClick={() => toast("Filtres appliqués")}>
              Filtrer
            </button>
            <button className="bo-btn-secondary">↓ Export CSV</button>
          </div>
        </div>
      </div>

      {/* Tableau transactions */}
      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">↕ Dernières transactions</span>
          <span className="text-[11px] text-t-faint">{DEMO_TRANSACTIONS.length} transactions</span>
        </div>
        <table className="bo-table">
          <thead>
            <tr>
              <th>#TX</th>
              <th>Utilisateur</th>
              <th>Type</th>
              <th>Montant</th>
              <th>Méthode</th>
              <th>Statut</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_TRANSACTIONS.map((tx) => (
              <tr key={tx.id}>
                <td className="font-mono text-t-faint text-[11px]">{tx.id}</td>
                <td>{tx.user}</td>
                <td>{txTypeBadge(tx.type)}</td>
                <td className={`font-mono font-bold ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                  {tx.amount > 0 ? "+" : ""}{formatXAF(Math.abs(tx.amount) * 100)}
                </td>
                <td className="text-t-muted">{tx.method}</td>
                <td>{txStatusBadge(tx.status)}</td>
                <td className="font-mono text-t-faint">{tx.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
