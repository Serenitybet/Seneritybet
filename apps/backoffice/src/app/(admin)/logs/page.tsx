"use client";

import { useEffect, useState } from "react";

const LEVEL_STYLE: Record<string, string> = {
  INFO:  "text-green-400",
  WARN:  "text-orange-400",
  ERROR: "text-red-400",
};

export default function LogsPage() {
  const [filter, setFilter] = useState("Tous");
  const [logs, setLogs] = useState<{time: string; level: string; msg: string}[]>([]);

  // Logs en direct depuis la console du navigateur (API calls réels)
  useEffect(() => {
    setLogs([{
      time: new Date().toLocaleTimeString("fr-FR"),
      level: "INFO",
      msg: `Backoffice Serenitybet connecté — ${new Date().toLocaleDateString("fr-FR")}`,
    }]);
  }, []);

  const filtered = filter === "Tous" ? logs : logs.filter(l => l.level === filter);

  return (
    <div className="space-y-4">
      <div className="bo-filter-bar">
        <select className="bo-select" value={filter} onChange={e => setFilter(e.target.value)}>
          {["Tous","INFO","WARN","ERROR"].map(f => <option key={f}>{f}</option>)}
        </select>
        <div className="flex-1" />
        <span className="text-xs text-t-faint">Les logs API sont visibles dans Render → Logs</span>
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
            <span className="text-t-faint">Aucun log à afficher.</span>
          ) : (
            filtered.map((log, i) => (
              <div key={i} className="flex gap-4 mb-2 hover:bg-bo-surface/40 px-1 py-0.5 rounded">
                <span className="text-t-faint min-w-[56px] shrink-0">{log.time}</span>
                <span className={`min-w-[44px] font-bold shrink-0 ${LEVEL_STYLE[log.level]}`}>[{log.level}]</span>
                <span className="text-t-muted">{log.msg}</span>
              </div>
            ))
          )}
          <div className="mt-4 p-3 bg-bo-surface border border-bo-border rounded-lg text-t-faint">
            <p>📋 Pour les logs complets de l'API (erreurs, requêtes), consultez :</p>
            <p className="text-green-400 mt-1">Render.com → Seneritybet → Logs</p>
          </div>
        </div>
      </div>
    </div>
  );
}
