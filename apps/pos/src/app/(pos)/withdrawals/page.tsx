"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { api, formatXAF, setAuthToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

interface PendingWithdrawal {
  id: string;
  requestCode: string;
  amountXAF: number;
  shop: { name: string; city: string };
  createdAt: string;
  expiresAt: string;
}

interface PlayerInfo {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export default function WithdrawalsPage() {
  const { token } = useAuthStore();
  const [playerId, setPlayerId] = useState("");
  const [searching, setSearching] = useState(false);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [requests, setRequests] = useState<PendingWithdrawal[]>([]);
  const [validating, setValidating] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<any | null>(null);

  async function searchPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!playerId.trim()) return;
    if (token) setAuthToken(token);
    setSearching(true);
    setPlayer(null);
    setRequests([]);
    setReceipt(null);
    try {
      const res = await api.get(`/cashier/pending-withdrawals/${playerId.trim()}`);
      setPlayer(res.data.data.player);
      setRequests(res.data.data.pendingWithdrawals);
      if (res.data.data.pendingWithdrawals.length === 0) {
        toast("Aucune demande de retrait en attente pour ce joueur", { icon: "ℹ️" });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Joueur introuvable");
    } finally {
      setSearching(false);
    }
  }

  async function validateWithdrawal(requestId: string) {
    if (!confirm("Confirmer le paiement de ce retrait ?")) return;
    if (token) setAuthToken(token);
    setValidating(requestId);
    try {
      const res = await api.post(`/cashier/validate-withdrawal/${requestId}`, {});
      setReceipt(res.data.data);
      setRequests(prev => prev.filter(r => r.id !== requestId));
      toast.success("Retrait validé ✅");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Erreur lors de la validation");
    } finally {
      setValidating(null);
    }
  }

  function reset() {
    setPlayerId("");
    setPlayer(null);
    setRequests([]);
    setReceipt(null);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Toaster position="top-center" />

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">💸 Valider un retrait</h2>
        <p className="text-sm text-gray-500 mb-4">
          Entrez le <strong>numéro joueur</strong> (ID à 6 chiffres, ex: 100001) <br/>
          ou le <strong>code de retrait</strong> que le joueur vous montre.
        </p>
        <form onSubmit={searchPlayer} className="flex gap-3">
          <input
            type="text"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            placeholder="N° joueur (100001) ou code retrait (794330)"
            className="flex-1 px-4 py-3 text-xl font-mono border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={searching}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl disabled:opacity-50"
          >
            {searching ? "..." : "Chercher"}
          </button>
        </form>
      </div>

      {/* Infos joueur + retraits en attente */}
      {player && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xl font-bold text-gray-900">
                👤 {player.firstName} {player.lastName}
              </p>
              <p className="text-gray-500 text-sm">📱 {player.phone}</p>
            </div>
            <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600 underline">
              Nouveau joueur
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">📭</div>
              <p>Aucune demande de retrait en attente</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-600 mb-2">
                {requests.length} demande(s) en attente :
              </p>
              {requests.map(r => (
                <div
                  key={r.id}
                  className="border-2 border-orange-200 bg-orange-50 rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-lg font-black text-orange-600">#{r.requestCode}</span>
                      <span className="text-2xl font-black text-gray-900">
                        {r.amountXAF.toLocaleString("fr-FR")} XAF
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      🏪 {r.shop.name} — {r.shop.city}
                    </p>
                    <p className="text-xs text-gray-400">
                      Expire le {new Date(r.expiresAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <button
                    onClick={() => validateWithdrawal(r.id)}
                    disabled={validating === r.id}
                    className="px-5 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl disabled:opacity-50 whitespace-nowrap"
                  >
                    {validating === r.id ? "..." : "✅ Payer"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reçu de validation */}
      {receipt && (
        <div className="bg-white rounded-2xl shadow-sm p-6 border-2 border-green-200">
          <h3 className="text-lg font-bold text-green-700 mb-4">✅ Retrait validé</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Client</span><p className="font-bold">{receipt.playerName}</p></div>
            <div><span className="text-gray-500">Téléphone</span><p className="font-bold">{receipt.phone}</p></div>
            <div><span className="text-gray-500">Montant payé</span>
              <p className="font-black text-xl text-red-600">-{receipt.amountXAF.toLocaleString("fr-FR")} XAF</p>
            </div>
            <div><span className="text-gray-500">Code demande</span><p className="font-mono font-bold">#{receipt.requestCode}</p></div>
            <div><span className="text-gray-500">Boutique</span><p className="font-bold">{receipt.shop}</p></div>
            <div><span className="text-gray-500">Référence</span>
              <p className="font-mono text-xs">{receipt.transactionId?.slice(-8).toUpperCase()}</p>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => window.print()} className="flex-1 py-2 bg-gray-100 rounded-xl text-sm font-semibold">
              🖨️ Imprimer
            </button>
            <button onClick={reset} className="flex-1 py-2 bg-green-600 text-white rounded-xl font-bold">
              Nouveau joueur
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
