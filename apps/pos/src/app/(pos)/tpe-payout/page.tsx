"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { api } from "@/lib/api";

interface TicketInfo {
  code: string;
  status: "PENDING" | "WON" | "LOST" | "REFUNDED" | "CANCELLED" | "PAID";
  stakeXAF: number;
  totalOdds: number;
  potentialWinXAF: number;
  items: { oddValue: number; result: string | null; market: { name: string; event: { homeTeam: string; awayTeam: string } }; odd: { label: string } }[];
}

const STATUS_LABEL: Record<TicketInfo["status"], string> = {
  PENDING: "⏳ Non encore réglé",
  WON: "✅ Gagnant",
  LOST: "❌ Perdant",
  REFUNDED: "↩️ Remboursé",
  CANCELLED: "🚫 Annulé",
  PAID: "💵 Déjà payé",
};

export default function TpePayoutPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<TicketInfo | null>(null);
  const [paying, setPaying] = useState(false);
  const [paidAmount, setPaidAmount] = useState<number | null>(null);

  async function searchTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setTicket(null);
    setPaidAmount(null);
    try {
      const res = await api.get(`/tpe/tickets/${code.trim().toUpperCase()}`);
      setTicket(res.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Code ticket introuvable");
    } finally {
      setLoading(false);
    }
  }

  async function payTicket() {
    if (!ticket) return;
    if (!confirm(`Payer ${ticket.status === "WON" ? ticket.potentialWinXAF.toLocaleString("fr-FR") : ticket.stakeXAF.toLocaleString("fr-FR")} XAF pour le ticket ${ticket.code} ?`)) return;
    setPaying(true);
    try {
      const res = await api.post(`/tpe/tickets/${ticket.code}/pay`);
      setPaidAmount(res.data.data.amountPaidXAF);
      toast.success("Paiement effectué ✅");
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Erreur lors du paiement");
    } finally {
      setPaying(false);
    }
  }

  const canPay = ticket && (ticket.status === "WON" || ticket.status === "REFUNDED");

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Toaster position="top-center" />

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">💵 Encaisser un ticket</h2>
        <p className="text-sm text-gray-500 mb-4">
          Entrez ou scannez le code du ticket (ex: <strong>ABX-739-KLP</strong>)
        </p>
        <form onSubmit={searchTicket} className="flex gap-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex: ABX-739-KLP"
            className="flex-1 px-4 py-3 text-2xl font-mono font-bold tracking-widest border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none uppercase"
            autoFocus
          />
          <button type="submit" disabled={loading}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl disabled:opacity-50">
            {loading ? "..." : "Chercher"}
          </button>
        </form>
      </div>

      {ticket && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-xl font-black">{ticket.code}</p>
              <p className="text-slate-300 text-sm">{STATUS_LABEL[ticket.status]}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-300">Cote totale</p>
              <p className="text-3xl font-black">{ticket.totalOdds.toFixed(2)}</p>
            </div>
          </div>

          <div className="p-4 space-y-2">
            {ticket.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {it.market.event.homeTeam} vs {it.market.event.awayTeam}
                  </p>
                  <p className="text-xs text-gray-500">{it.market.name}</p>
                  <span className="inline-block mt-0.5 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded">
                    {it.odd.label}
                  </span>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-black text-green-600 text-lg">{it.oddValue.toFixed(2)}</p>
                  {it.result && <p className="text-xs text-gray-400">{it.result}</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 pb-4">
            <div className="bg-gray-50 border rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Mise :</span>
                <span className="font-bold">{ticket.stakeXAF.toLocaleString("fr-FR")} XAF</span>
              </div>
              <div className="flex justify-between font-black text-lg text-green-700">
                <span>Gain potentiel :</span>
                <span>{ticket.potentialWinXAF.toLocaleString("fr-FR")} XAF</span>
              </div>
            </div>

            {paidAmount !== null ? (
              <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 text-center">
                <p className="text-green-700 font-black text-xl">✅ Payé : {paidAmount.toLocaleString("fr-FR")} XAF</p>
              </div>
            ) : canPay ? (
              <button onClick={payTicket} disabled={paying}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl disabled:opacity-50 text-lg">
                {paying ? "Paiement en cours…" : "💵 Payer en espèces"}
              </button>
            ) : (
              <p className="text-center text-sm text-gray-400">Rien à payer pour ce ticket.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
