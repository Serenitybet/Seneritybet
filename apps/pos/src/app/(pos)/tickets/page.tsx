"use client";
export const dynamic = "force-dynamic";

import { useState, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import { api, formatXAF, setAuthToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

interface Selection {
  eventName: string;
  teamHome: string;
  teamAway: string;
  marketName: string;
  oddLabel: string;
  oddValue: number;
  competition?: string;
  eventDate?: string;
}

interface CouponData {
  code: string;
  player: { firstName: string; lastName: string; phone: string; playerNumber: number } | null;
  selections: Selection[];
  totalOdds: number;
  suggestedStakeXAF: number | null;
}

interface Ticket {
  betId: string;
  ticketRef: string;
  code: string;
  playerName: string;
  playerPhone: string;
  playerNumber: number;
  selections: Selection[];
  totalOdds: number;
  stakeXAF: number;
  potentialWinXAF: number;
  placedAt: string;
}

export default function TicketsPage() {
  const { token } = useAuthStore();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [coupon, setCoupon] = useState<CouponData | null>(null);
  const [stakeXAF, setStakeXAF] = useState("");
  const [payWithCash, setPayWithCash] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const QUICK_STAKES = [500, 1000, 2000, 5000, 10000, 25000];

  async function searchCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    if (token) setAuthToken(token);
    setLoading(true);
    setCoupon(null);
    setTicket(null);
    try {
      const res = await api.get(`/coupons/cashier/${code.trim().toUpperCase()}`);
      setCoupon(res.data.data);
      setStakeXAF(res.data.data.suggestedStakeXAF?.toString() ?? "");
      toast.success("Coupon trouvé ✅");
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Code introuvable");
    } finally {
      setLoading(false);
    }
  }

  async function placeTicket() {
    if (!coupon || !stakeXAF) return;
    const stake = parseFloat(stakeXAF);
    if (isNaN(stake) || stake < 100) { toast.error("Mise minimum 100 XAF"); return; }
    if (!confirm(`Confirmer le ticket ?\nMise : ${stake.toLocaleString("fr-FR")} XAF\nGain potentiel : ${(stake * coupon.totalOdds).toLocaleString("fr-FR")} XAF`)) return;

    if (token) setAuthToken(token);
    setPlacing(true);
    try {
      const res = await api.post("/coupons/cashier/place", {
        code: coupon.code,
        stakeXAF: stake,
        payWithCash,
      });
      setTicket(res.data.data);
      setCoupon(null);
      toast.success("Ticket enregistré ! 🎫");
      setTimeout(() => window.print(), 500);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Erreur lors du placement");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 no-print">
      <Toaster position="top-center" />

      {/* Recherche coupon */}
      {!ticket && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1">🎫 Ticket physique</h2>
          <p className="text-sm text-gray-500 mb-4">
            Entrez le code coupon du joueur (ex: <strong>ABX-739-KLP</strong>)
          </p>
          <form onSubmit={searchCoupon} className="flex gap-3">
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
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
      )}

      {/* Coupon trouvé */}
      {coupon && !ticket && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-green-700 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-xl font-black">{coupon.code}</p>
              {coupon.player && (
                <p className="text-green-200 text-sm">
                  {coupon.player.firstName} {coupon.player.lastName} · #{coupon.player.playerNumber}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-green-200">Cote totale</p>
              <p className="text-3xl font-black">{coupon.totalOdds.toFixed(2)}</p>
            </div>
          </div>

          {/* Sélections */}
          <div className="p-4 space-y-2">
            {coupon.selections.map((s, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {s.teamHome} vs {s.teamAway}
                  </p>
                  <p className="text-xs text-gray-500">{s.competition ?? s.marketName}</p>
                  <span className="inline-block mt-0.5 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded">
                    {s.oddLabel}
                  </span>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-black text-green-600 text-lg">{Number(s.oddValue).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Mise + Options */}
          <div className="px-4 pb-4 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Mise (XAF)</label>
              <input
                type="number"
                value={stakeXAF}
                onChange={e => setStakeXAF(e.target.value)}
                placeholder="Montant misé"
                className="w-full px-4 py-3 text-xl font-bold border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                {QUICK_STAKES.map(s => (
                  <button key={s} onClick={() => setStakeXAF(String(s))}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-green-100 text-gray-700 rounded-lg text-sm font-semibold">
                    {s.toLocaleString("fr-FR")}
                  </button>
                ))}
              </div>
            </div>

            {stakeXAF && parseFloat(stakeXAF) > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Mise :</span>
                  <span className="font-bold">{parseFloat(stakeXAF).toLocaleString("fr-FR")} XAF</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Cote :</span>
                  <span className="font-bold">x{coupon.totalOdds.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-lg text-green-700">
                  <span>Gain potentiel :</span>
                  <span>{(parseFloat(stakeXAF) * coupon.totalOdds).toLocaleString("fr-FR")} XAF</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={payWithCash} onChange={e => setPayWithCash(e.target.checked)}
                  className="w-4 h-4 accent-green-600" />
                <span className="text-sm font-medium text-gray-700">💵 Paiement en espèces</span>
              </label>
              <span className="text-xs text-gray-400">(décocher si le joueur paie via son solde)</span>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setCoupon(null); setCode(""); }}
                className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-semibold rounded-xl">
                Annuler
              </button>
              <button onClick={placeTicket} disabled={placing || !stakeXAF}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl disabled:opacity-50 text-lg">
                {placing ? "Enregistrement..." : "🎫 Valider & Imprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket imprimé */}
      {ticket && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-xl font-black text-green-700">Ticket enregistré !</p>
            <p className="font-mono text-gray-500">{ticket.ticketRef}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => window.print()}
              className="flex-1 py-3 bg-gray-800 text-white font-bold rounded-xl">
              🖨️ Ré-imprimer
            </button>
            <button onClick={() => { setTicket(null); setCode(""); }}
              className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl">
              Nouveau ticket
            </button>
          </div>
        </div>
      )}

      {/* Zone d'impression */}
      {ticket && (
        <div className="print-only" ref={printRef}>
          <div style={{ fontFamily: "monospace", maxWidth: 320, margin: "0 auto", padding: 16, border: "1px solid #000" }}>
            <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 8 }}>
              <p style={{ fontSize: 20, fontWeight: "bold" }}>SERENITYBET</p>
              <p style={{ fontSize: 12 }}>Ticket de pari sportif</p>
              <p style={{ fontSize: 10, color: "#666" }}>Licence de jeux — République du Tchad</p>
            </div>
            <div style={{ marginBottom: 8 }}>
              <p><strong>Réf:</strong> {ticket.ticketRef}</p>
              <p><strong>Code:</strong> {ticket.code}</p>
              <p><strong>Joueur:</strong> {ticket.playerName} (#{ticket.playerNumber})</p>
              <p><strong>Date:</strong> {new Date(ticket.placedAt).toLocaleString("fr-FR")}</p>
            </div>
            <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "8px 0", marginBottom: 8 }}>
              <p style={{ fontWeight: "bold", marginBottom: 4 }}>SÉLECTIONS ({ticket.selections.length})</p>
              {ticket.selections.map((s, i) => (
                <div key={i} style={{ marginBottom: 6, fontSize: 11 }}>
                  <p>{i + 1}. {s.teamHome} vs {s.teamAway}</p>
                  <p style={{ paddingLeft: 12 }}>→ {s.oddLabel} @ <strong>{Number(s.oddValue).toFixed(2)}</strong></p>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 8, fontSize: 13 }}>
              <p>Cote totale : <strong>{ticket.totalOdds.toFixed(2)}</strong></p>
              <p>Mise : <strong>{ticket.stakeXAF.toLocaleString("fr-FR")} XAF</strong></p>
              <p style={{ fontSize: 16, fontWeight: "bold" }}>
                Gain potentiel : {ticket.potentialWinXAF.toLocaleString("fr-FR")} XAF
              </p>
            </div>
            <div style={{ textAlign: "center", borderTop: "2px solid #000", paddingTop: 8, fontSize: 10 }}>
              <p>Jouez responsablement. +18 ans uniquement.</p>
              <p>En cas de gain, présentez ce ticket en caisse.</p>
              <p style={{ fontFamily: "monospace", fontSize: 14, fontWeight: "bold", marginTop: 4 }}>
                ████ {ticket.betId.slice(-10).toUpperCase()} ████
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
