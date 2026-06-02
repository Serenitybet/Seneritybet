"use client";

import { useState, useEffect } from "react";
import { api, formatXAF, setAuthToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import clsx from "clsx";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Transaction {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amountXAF: number;
  status: string;
  createdAt: string;
  player: { firstName: string; lastName: string; phone: string };
}

interface Stats {
  totalDepositsXAF: number;
  totalWithdrawalsXAF: number;
  countDeposits: number;
  countWithdrawals: number;
  netXAF: number;
}

export default function HistoryPage() {
  const { token } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // S'assurer que le token est bien défini avant l'appel
    if (token) setAuthToken(token);

    async function load() {
      try {
        const res = await api.get("/cashier/transactions");
        setTransactions(res.data.data.transactions);
        setStats(res.data.data.stats);
      } catch {
        console.error("Erreur chargement historique");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 Historique du jour</h1>
          <p className="text-gray-500 capitalize">{today}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm no-print"
        >
          🖨️ Imprimer la clôture
        </button>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 no-print">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="text-gray-500 text-sm mb-1">Dépôts</div>
            <div className="text-2xl font-black text-green-600">{formatXAF(stats.totalDepositsXAF * 100)}</div>
            <div className="text-xs text-gray-400 mt-1">{stats.countDeposits} transaction(s)</div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="text-gray-500 text-sm mb-1">Retraits</div>
            <div className="text-2xl font-black text-red-600">{formatXAF(stats.totalWithdrawalsXAF * 100)}</div>
            <div className="text-xs text-gray-400 mt-1">{stats.countWithdrawals} transaction(s)</div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm sm:col-span-2">
            <div className="text-gray-500 text-sm mb-1">Solde net de caisse</div>
            <div className={clsx(
              "text-3xl font-black",
              stats.netXAF >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {stats.netXAF >= 0 ? "+" : ""}{formatXAF(stats.netXAF * 100)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {stats.countDeposits + stats.countWithdrawals} opération(s) au total
            </div>
          </div>
        </div>
      )}

      {/* Liste des transactions */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Chargement...</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-2">📭</div>
            <div>Aucune transaction en espèces aujourd&apos;hui</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 font-semibold">
              <tr>
                <th className="text-left px-4 py-3">Heure</th>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Montant</th>
                <th className="text-left px-4 py-3">Réf.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">
                    {format(new Date(t.createdAt), "HH:mm")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">
                      {t.player.firstName} {t.player.lastName}
                    </div>
                    <div className="text-gray-400 text-xs">{t.player.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      "px-2 py-1 rounded-full text-xs font-bold",
                      t.type === "DEPOSIT"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    )}>
                      {t.type === "DEPOSIT" ? "⬇️ Dépôt" : "⬆️ Retrait"}
                    </span>
                  </td>
                  <td className={clsx(
                    "px-4 py-3 text-right font-bold",
                    t.type === "DEPOSIT" ? "text-green-600" : "text-red-600"
                  )}>
                    {t.type === "DEPOSIT" ? "+" : "-"}{t.amountXAF.toLocaleString("fr-FR")} XAF
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {t.id.slice(-6).toUpperCase()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
