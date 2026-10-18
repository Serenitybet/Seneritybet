"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface TicketRow {
  id: string;
  code: string;
  status: "PENDING" | "WON" | "LOST" | "REFUNDED" | "CANCELLED" | "PAID";
  stakeXAF: number;
  potentialWinXAF: number;
  createdAt: string;
}

const STATUS_STYLE: Record<TicketRow["status"], string> = {
  PENDING: "bg-slate-700 text-slate-300",
  WON: "bg-green-500/20 text-green-400",
  LOST: "bg-red-500/20 text-red-400",
  REFUNDED: "bg-blue-500/20 text-blue-400",
  CANCELLED: "bg-slate-700 text-slate-400",
  PAID: "bg-amber-500/20 text-amber-400",
};
const STATUS_LABEL: Record<TicketRow["status"], string> = {
  PENDING: "En attente",
  WON: "Gagnant",
  LOST: "Perdant",
  REFUNDED: "Remboursé",
  CANCELLED: "Annulé",
  PAID: "Payé",
};

export default function TpeHistoryPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/tpe/tickets?limit=50")
      .then((r) => setTickets(r.data.data.tickets))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-lg font-bold text-gray-800">🧾 Historique de paris — ce TPE</h1>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Chargement…</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-2">🧾</div>
            <div>Aucun ticket créé sur ce TPE pour l'instant</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tickets.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-mono font-bold text-gray-900 text-sm">{t.code}</p>
                  <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleString("fr-FR")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Mise {t.stakeXAF.toLocaleString("fr-FR")} XAF</p>
                    <p className="text-sm font-black text-gray-800">{t.potentialWinXAF.toLocaleString("fr-FR")} XAF</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
