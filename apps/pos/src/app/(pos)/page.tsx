"use client";

import { useState, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import { api, formatXAF, xafToCentimes } from "@/lib/api";
import clsx from "clsx";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  balance: number;
  bonusBalance: number;
  kycStatus: string;
}

interface Receipt {
  transactionId: string;
  playerName: string;
  phone: string;
  amountXAF: number;
  newBalanceXAF: number;
  createdAt: string;
  type: "DEPOT" | "RETRAIT";
}

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 25000, 50000];

export default function CaissePage() {
  const [phone, setPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [mode, setMode] = useState<"DEPOT" | "RETRAIT" | null>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  async function searchCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setSearching(true);
    setCustomer(null);
    setMode(null);
    setAmount("");
    setReceipt(null);
    try {
      const res = await api.get(`/api/cashier/customer/${phone.trim()}`);
      setCustomer(res.data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Client introuvable");
    } finally {
      setSearching(false);
    }
  }

  async function processTransaction() {
    if (!customer || !mode || !amount) return;
    const xaf = parseFloat(amount);
    if (isNaN(xaf) || xaf <= 0) { toast.error("Montant invalide"); return; }

    setProcessing(true);
    try {
      const endpoint = mode === "DEPOT" ? "/api/cashier/deposit" : "/api/cashier/withdraw";
      const res = await api.post(endpoint, {
        playerId: customer.id,
        amount: xafToCentimes(xaf),
        notes,
      });
      const data = res.data.data;

      setReceipt({ ...data, type: mode });
      setCustomer(prev => prev ? { ...prev, balance: data.newBalanceXAF * 100 } : null);
      setMode(null);
      setAmount("");
      setNotes("");
      toast.success(mode === "DEPOT" ? "Dépôt effectué ✅" : "Retrait effectué ✅");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Erreur lors de la transaction");
    } finally {
      setProcessing(false);
    }
  }

  function reset() {
    setCustomer(null);
    setPhone("");
    setMode(null);
    setAmount("");
    setNotes("");
    setReceipt(null);
    phoneRef.current?.focus();
  }

  function printReceipt() {
    window.print();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Toaster position="top-center" />

      {/* ─── Reçu imprimable ─── */}
      {receipt && (
        <div className="print-only p-8 font-mono text-sm">
          <div className="text-center border-b pb-4 mb-4">
            <div className="text-xl font-bold">SERENITYBET</div>
            <div>Reçu de {receipt.type === "DEPOT" ? "Dépôt" : "Retrait"}</div>
            <div>{new Date(receipt.createdAt).toLocaleString("fr-FR")}</div>
          </div>
          <div className="space-y-1">
            <div>Réf: {receipt.transactionId.slice(-8).toUpperCase()}</div>
            <div>Client: {receipt.playerName}</div>
            <div>Téléphone: {receipt.phone}</div>
            <div className="border-t pt-2 mt-2 font-bold text-lg">
              {receipt.type === "DEPOT" ? "+" : "-"}{receipt.amountXAF.toLocaleString("fr-FR")} XAF
            </div>
            <div>Nouveau solde: {receipt.newBalanceXAF.toLocaleString("fr-FR")} XAF</div>
          </div>
          <div className="text-center mt-4 border-t pt-4 text-xs">Merci de jouer responsable</div>
        </div>
      )}

      {/* ─── Recherche ─── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 no-print">
        <h2 className="text-lg font-bold text-gray-800 mb-4">🔍 Rechercher un client</h2>
        <form onSubmit={searchCustomer} className="flex gap-3">
          <input
            ref={phoneRef}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Numéro de téléphone (ex: 63000000)"
            className="flex-1 px-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={searching}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 text-lg"
          >
            {searching ? "..." : "Chercher"}
          </button>
        </form>
      </div>

      {/* ─── Infos client ─── */}
      {customer && (
        <div className="bg-white rounded-2xl shadow-sm p-6 no-print">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">👤</span>
                <h3 className="text-2xl font-bold text-gray-900">
                  {customer.firstName} {customer.lastName}
                </h3>
                <span className={clsx(
                  "text-xs font-semibold px-2 py-1 rounded-full",
                  customer.kycStatus === "APPROVED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                )}>
                  {customer.kycStatus === "APPROVED" ? "✅ KYC OK" : "⚠️ KYC " + customer.kycStatus}
                </span>
              </div>
              <div className="text-gray-500 mb-4">📱 {customer.phone}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-gray-500 text-sm">Solde disponible :</span>
                <span className="text-3xl font-black text-green-600">
                  {formatXAF(customer.balance)}
                </span>
              </div>
            </div>
            <button onClick={reset} className="text-gray-400 hover:text-gray-600 text-sm underline">
              Nouveau client
            </button>
          </div>

          {/* Boutons d'action */}
          {!mode && (
            <div className="grid grid-cols-2 gap-4 mt-6">
              <button
                onClick={() => setMode("DEPOT")}
                className="py-6 bg-green-500 hover:bg-green-600 text-white text-xl font-black rounded-2xl transition-colors shadow-lg"
              >
                ⬇️ DÉPÔT
              </button>
              <button
                onClick={() => setMode("RETRAIT")}
                className="py-6 bg-red-500 hover:bg-red-600 text-white text-xl font-black rounded-2xl transition-colors shadow-lg"
              >
                ⬆️ RETRAIT
              </button>
            </div>
          )}

          {/* Formulaire de transaction */}
          {mode && (
            <div className={clsx(
              "mt-6 p-5 rounded-2xl border-2",
              mode === "DEPOT" ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
            )}>
              <div className="flex items-center justify-between mb-4">
                <h4 className={clsx(
                  "text-xl font-bold",
                  mode === "DEPOT" ? "text-green-700" : "text-red-700"
                )}>
                  {mode === "DEPOT" ? "⬇️ Dépôt espèces" : "⬆️ Retrait espèces"}
                </h4>
                <button
                  onClick={() => { setMode(null); setAmount(""); setNotes(""); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕ Annuler
                </button>
              </div>

              {/* Montants rapides */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {QUICK_AMOUNTS.map(q => (
                  <button
                    key={q}
                    onClick={() => setAmount(q.toString())}
                    className={clsx(
                      "py-3 rounded-xl font-bold text-sm transition-colors",
                      amount === q.toString()
                        ? (mode === "DEPOT" ? "bg-green-600 text-white" : "bg-red-600 text-white")
                        : "bg-white border-2 border-gray-200 hover:border-gray-400 text-gray-700"
                    )}
                  >
                    {q.toLocaleString("fr-FR")} XAF
                  </button>
                ))}
              </div>

              {/* Montant personnalisé */}
              <div className="mb-3">
                <label className="block text-sm font-semibold text-gray-600 mb-1">Montant (XAF)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Saisir un montant..."
                  className="w-full px-4 py-3 text-2xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                  min="100"
                />
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-600 mb-1">Notes (optionnel)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Dépôt initial, tournoi..."
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                />
              </div>

              {/* Confirmation */}
              {amount && parseFloat(amount) > 0 && (
                <div className="bg-white border rounded-xl p-4 mb-4 text-center">
                  <div className="text-gray-500 text-sm mb-1">Montant de la transaction :</div>
                  <div className={clsx(
                    "text-4xl font-black",
                    mode === "DEPOT" ? "text-green-600" : "text-red-600"
                  )}>
                    {mode === "DEPOT" ? "+" : "-"}{parseFloat(amount || "0").toLocaleString("fr-FR")} XAF
                  </div>
                  <div className="text-gray-400 text-sm mt-1">
                    Nouveau solde estimé :{" "}
                    <strong>
                      {formatXAF(
                        customer.balance +
                        (mode === "DEPOT" ? 1 : -1) * xafToCentimes(parseFloat(amount || "0"))
                      )}
                    </strong>
                  </div>
                </div>
              )}

              <button
                onClick={processTransaction}
                disabled={processing || !amount || parseFloat(amount) <= 0}
                className={clsx(
                  "w-full py-4 text-white text-xl font-black rounded-2xl transition-colors disabled:opacity-40",
                  mode === "DEPOT"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                )}
              >
                {processing ? "Traitement en cours..." : `Confirmer le ${mode === "DEPOT" ? "dépôt" : "retrait"}`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Reçu de la dernière transaction ─── */}
      {receipt && (
        <div className="bg-white rounded-2xl shadow-sm p-6 border-2 border-green-200 no-print">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-green-700">✅ Transaction réussie</h3>
            <button
              onClick={printReceipt}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors"
            >
              🖨️ Imprimer le reçu
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Client</div>
              <div className="font-bold text-gray-900">{receipt.playerName}</div>
            </div>
            <div>
              <div className="text-gray-500">Téléphone</div>
              <div className="font-bold text-gray-900">{receipt.phone}</div>
            </div>
            <div>
              <div className="text-gray-500">Type</div>
              <div className={clsx(
                "font-bold",
                receipt.type === "DEPOT" ? "text-green-600" : "text-red-600"
              )}>
                {receipt.type === "DEPOT" ? "⬇️ Dépôt" : "⬆️ Retrait"}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Montant</div>
              <div className={clsx(
                "font-black text-xl",
                receipt.type === "DEPOT" ? "text-green-600" : "text-red-600"
              )}>
                {receipt.type === "DEPOT" ? "+" : "-"}{receipt.amountXAF.toLocaleString("fr-FR")} XAF
              </div>
            </div>
            <div>
              <div className="text-gray-500">Nouveau solde</div>
              <div className="font-bold text-gray-900 text-lg">
                {formatXAF(receipt.newBalanceXAF * 100)}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Référence</div>
              <div className="font-mono text-xs text-gray-700">
                {receipt.transactionId.slice(-8).toUpperCase()}
              </div>
            </div>
          </div>
          <button
            onClick={reset}
            className="mt-4 w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors"
          >
            Nouveau client
          </button>
        </div>
      )}
    </div>
  );
}
