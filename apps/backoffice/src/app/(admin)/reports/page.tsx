"use client";

import { useEffect, useState } from "react";
import { formatXAF } from "@serenitybet/shared";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";


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
      label: "Dépôts de la période",
      value: apiData.length ? formatXAF(apiData.filter((t: any) => t.type === "DEPOSIT").reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0)) : "—",
      sub: `${apiData.filter((t: any) => t.type === "DEPOSIT").length} transactions`,
      accent: "border-green-500",
      color: "text-green-400",
    },
    {
      label: "Retraits de la période",
      value: apiData.length ? formatXAF(apiData.filter((t: any) => t.type === "WITHDRAWAL").reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0)) : "—",
      sub: `${apiData.filter((t: any) => t.type === "WITHDRAWAL").length} transactions`,
      accent: "border-red-500",
      color: "text-red-400",
    },
    {
      label: "Total transactions",
      value: apiData.length ? apiData.length.toString() : "—",
      sub: "Sur la période sélectionnée",
      accent: "border-blue-500",
      color: "text-blue-400",
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
          <span className="text-[11px] text-t-faint">{apiData.length} transactions</span>
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
            {apiData.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-t-faint">Aucune transaction sur cette période</td></tr>
            ) : (
              apiData.map((tx: any) => (
                <tr key={tx.id}>
                  <td className="font-mono text-t-faint text-[11px]">{tx.id?.slice(-8).toUpperCase()}</td>
                  <td className="text-t-muted">{tx.user?.firstName} {tx.user?.lastName}</td>
                  <td>{txTypeBadge(tx.type)}</td>
                  <td className={`font-mono font-bold ${Number(tx.amount) > 0 ? "text-green-400" : "text-red-400"}`}>
                    {Number(tx.amount) > 0 ? "+" : ""}{formatXAF(Math.abs(Number(tx.amount)))}
                  </td>
                  <td className="text-t-muted">{tx.provider}</td>
                  <td>{txStatusBadge(tx.status)}</td>
                  <td className="font-mono text-t-faint text-xs">{new Date(tx.createdAt).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
