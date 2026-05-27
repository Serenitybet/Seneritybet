"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { format } from "date-fns";

const LOG_ENTRIES = [
  { time: "14:32:01", level: "INFO",  msg: "Pari #BT-4821 enregistré — @mbaye_d — 5 000 XAF sur Bayern Munich" },
  { time: "14:28:44", level: "INFO",  msg: "Connexion admin — IP 197.242.10.x" },
  { time: "14:21:18", level: "INFO",  msg: "Dépôt confirmé — @ali_hassan — 50 000 XAF via Airtel Money" },
  { time: "14:10:03", level: "WARN",  msg: "Demande retrait > 10 000 XAF — @mbaye_d — validation requise" },
  { time: "13:55:22", level: "INFO",  msg: "Pari #BT-4819 résolu — GAGNÉ — @fatou_k — +7 350 XAF" },
  { time: "13:40:15", level: "INFO",  msg: "Pari #BT-4818 résolu — PERDU — @jean_p — -10 000 XAF" },
  { time: "13:30:08", level: "ERROR", msg: "Retrait échoué — @jean_p — KYC non validé" },
  { time: "13:22:55", level: "INFO",  msg: "Pari #BT-4817 enregistré — @omar_s — 7 500 XAF sur Inter Milan" },
  { time: "12:44:31", level: "INFO",  msg: "Dépôt confirmé — @omar_s — 100 000 XAF via Orange Money" },
  { time: "12:30:00", level: "INFO",  msg: "Mise à jour cotes — Real Madrid vs Bayern — TheOddsAPI" },
  { time: "11:59:12", level: "WARN",  msg: "Cote suspendue — Real Madrid gagne — variation >20%" },
  { time: "11:30:45", level: "INFO",  msg: "Nouveau parieur inscrit — @hassan_b — hassan.boukar@email.com" },
  { time: "10:00:00", level: "INFO",  msg: "Rapport journalier généré et envoyé — admin@serenitybet.td" },
  { time: "09:45:12", level: "WARN",  msg: "Pari à risque élevé détecté — @hassan_b — 50 000 XAF — mise en revue" },
  { time: "09:00:00", level: "INFO",  msg: "Service démarré — API Serenitybet v1.0.0 — Port 4000" },
];

const LEVEL_STYLE: Record<string, string> = {
  INFO:  "text-green-400",
  WARN:  "text-orange-400",
  ERROR: "text-red-400",
};

export default function LogsPage() {
  const [logs, setLogs] = useState(LOG_ENTRIES);
  const [filter, setFilter] = useState("Tous");

  const filtered = filter === "Tous" ? logs : logs.filter(l => l.level === filter);

  return (
    <div className="space-y-4">
      <div className="bo-filter-bar">
        <select className="bo-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {["Tous","INFO","WARN","ERROR"].map(f => <option key={f}>{f}</option>)}
        </select>
        <div className="flex-1" />
        <button className="bo-btn-secondary" onClick={() => toast("Logs téléchargés")}>↓ Télécharger</button>
        <button className="bo-btn-danger" onClick={() => { setLogs([]); toast.success("Logs vidés"); }}>🗑 Vider</button>
      </div>

      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">▶ Logs système</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              En direct
            </span>
          </div>
        </div>
        <div className="bg-bo-base rounded-b-xl p-4 font-mono text-xs max-h-[500px] overflow-y-auto">
          {filtered.length === 0 ? (
            <span className="text-t-faint">Aucun log.</span>
          ) : (
            filtered.map((log, i) => (
              <div key={i} className="flex gap-4 mb-2 hover:bg-bo-surface/40 px-1 py-0.5 rounded">
                <span className="text-t-faint min-w-[56px] shrink-0">{log.time}</span>
                <span className={`min-w-[44px] font-bold shrink-0 ${LEVEL_STYLE[log.level]}`}>
                  [{log.level}]
                </span>
                <span className="text-t-muted">{log.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
