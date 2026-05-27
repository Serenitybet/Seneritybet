"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useWalletStore } from "@/store/wallet.store";
import { formatXAF, PAYMENT_PROVIDER_LABELS, type PaymentProvider } from "@serenitybet/shared";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const PROVIDERS: PaymentProvider[] = ["AIRTEL_MONEY", "ORANGE_MONEY", "MOOV_MONEY"];

const PROVIDER_META: Record<PaymentProvider, { color: string; bg: string; icon: string }> = {
  AIRTEL_MONEY:  { color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",    icon: "📱" },
  ORANGE_MONEY:  { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", icon: "🟠" },
  MOOV_MONEY:    { color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",  icon: "💎" },
};

function txTypeLabel(type: string) {
  const map: Record<string, string> = {
    DEPOSIT: "Dépôt", WITHDRAWAL: "Retrait", BET: "Pari", WIN: "Gain", BONUS: "Bonus", REFUND: "Remboursement",
  };
  return map[type] ?? type;
}

function txStatusBadge(status: string) {
  const map: Record<string, string> = {
    COMPLETED: "bg-green-600/20 text-green-400",
    PENDING:   "bg-gold/20 text-gold",
    FAILED:    "bg-live/10 text-live",
    CANCELLED: "bg-bg-hover text-txt-muted",
  };
  const label: Record<string, string> = {
    COMPLETED: "Complété", PENDING: "En attente", FAILED: "Échoué", CANCELLED: "Annulé",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${map[status] ?? "bg-bg-hover text-txt-muted"}`}>
      {label[status] ?? status}
    </span>
  );
}

export default function WalletPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { balance, bonusBalance, fetchBalance } = useWalletStore();

  const [tab, setTab] = useState<"deposit" | "withdraw" | "history">("deposit");
  const [form, setForm] = useState({ amount: "", provider: "AIRTEL_MONEY" as PaymentProvider, phone: "" });
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetchBalance();
  }, [user]);

  useEffect(() => {
    if (tab === "history") loadTransactions();
  }, [tab]);

  async function loadTransactions() {
    setTxLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${API}/wallet/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.data?.transactions ?? []);
      }
    } catch {
      // ignore
    } finally {
      setTxLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${API}/wallet/${tab}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: parseInt(form.amount) * 100,
          provider: form.provider,
          phoneNumber: form.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
      toast.success(data.data?.message ?? "Opération envoyée ✓");
      fetchBalance();
      setForm((f) => ({ ...f, amount: "" }));
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  const TABS = [
    { id: "deposit",  label: "Dépôt",      icon: "⬆️" },
    { id: "withdraw", label: "Retrait",     icon: "⬇️" },
    { id: "history",  label: "Historique",  icon: "📋" },
  ] as const;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-txt-muted hover:text-txt-primary transition-colors text-sm"
        >
          ← Retour
        </button>
        <h1 className="text-lg font-black text-txt-primary">Portefeuille</h1>
      </div>

      {/* Carte solde */}
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-txt-muted mb-0.5">Solde disponible</p>
            <p className="text-3xl font-black text-green-400">{formatXAF(balance)}</p>
            {bonusBalance > 0 && (
              <p className="text-xs text-gold mt-1 flex items-center gap-1">
                <span>🎁</span> {formatXAF(bonusBalance)} en bonus
              </p>
            )}
          </div>
          <div className="w-14 h-14 bg-green-600/10 border border-green-600/20 rounded-2xl flex items-center justify-center">
            <span className="text-2xl font-black text-green-400">₣</span>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
              tab === t.id
                ? "bg-green-600/20 border-green-600/40 text-green-400"
                : "bg-bg-card border-bg-border text-txt-muted hover:text-txt-primary"
            }`}
          >
            <span className="text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Formulaire dépôt / retrait */}
      {(tab === "deposit" || tab === "withdraw") && (
        <form onSubmit={handleSubmit} className="bg-bg-secondary border border-bg-border rounded-2xl p-5 space-y-4">
          {/* Sélection opérateur */}
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-2">
              Opérateur Mobile Money
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map((p) => {
                const meta = PROVIDER_META[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, provider: p }))}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      form.provider === p
                        ? `${meta.bg} ${meta.color}`
                        : "bg-bg-card border-bg-border text-txt-muted hover:border-bg-hover"
                    }`}
                  >
                    <span className="text-base">{meta.icon}</span>
                    <span>{PAYMENT_PROVIDER_LABELS[p].split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Numéro de téléphone */}
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">
              Numéro {PAYMENT_PROVIDER_LABELS[form.provider]}
            </label>
            <div className="flex gap-2">
              <div className="flex items-center px-3 bg-bg-input border border-bg-border rounded-lg text-txt-muted text-sm shrink-0">
                🇹🇩 +235
              </div>
              <input
                type="tel"
                className="field flex-1"
                placeholder="XX XX XX XX"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Montant */}
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">
              Montant (XAF)
            </label>
            <input
              type="number"
              className="field text-lg font-bold"
              placeholder={tab === "deposit" ? "Min. 500 XAF" : "Min. 1 000 XAF"}
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              min={tab === "deposit" ? 500 : 1000}
              required
            />
            {/* Raccourcis montants */}
            <div className="flex gap-1.5 mt-2">
              {(tab === "deposit"
                ? [1000, 2000, 5000, 10000]
                : [1000, 2500, 5000, 10000]
              ).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, amount: String(v) }))}
                  className="flex-1 py-1.5 text-[11px] font-semibold bg-bg-card border border-bg-border rounded-lg text-txt-muted hover:text-green-400 hover:border-green-600/40 transition-all"
                >
                  {v >= 1000 ? `${v / 1000}k` : v}
                </button>
              ))}
            </div>
          </div>

          {tab === "withdraw" && (
            <div className="flex items-start gap-2 bg-gold/5 border border-gold/20 rounded-lg p-3">
              <span className="text-sm shrink-0">⚠️</span>
              <p className="text-[11px] text-txt-muted leading-relaxed">
                Les retraits sont traités sous 24–72h ouvrables. Votre compte doit être vérifié (KYC) pour retirer des fonds.
              </p>
            </div>
          )}

          <button
            type="submit"
            className="btn-green w-full py-3 text-sm font-bold"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Traitement en cours…
              </span>
            ) : tab === "deposit" ? (
              "💳 Déposer maintenant"
            ) : (
              "💸 Demander un retrait"
            )}
          </button>
        </form>
      )}

      {/* Historique */}
      {tab === "history" && (
        <div className="space-y-2">
          {txLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-bg-card border border-bg-border rounded-xl p-4 animate-pulse">
                  <div className="flex justify-between">
                    <div className="h-3 bg-bg-hover rounded w-1/3" />
                    <div className="h-3 bg-bg-hover rounded w-1/5" />
                  </div>
                  <div className="h-2 bg-bg-hover rounded w-1/2 mt-2" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-bg-card border border-bg-border rounded-2xl">
              <span className="text-4xl mb-3">📋</span>
              <p className="text-txt-primary font-semibold mb-1">Aucune transaction</p>
              <p className="text-txt-muted text-sm">Vos dépôts et retraits apparaîtront ici.</p>
            </div>
          ) : (
            transactions.map((tx: any) => (
              <div key={tx.id} className="bg-bg-card border border-bg-border rounded-xl p-4 hover:bg-bg-hover transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                      tx.type === "DEPOSIT" || tx.type === "WIN" || tx.type === "BONUS" || tx.type === "REFUND"
                        ? "bg-green-600/20 text-green-400"
                        : "bg-live/10 text-live"
                    }`}>
                      {tx.type === "DEPOSIT" ? "⬆️" : tx.type === "WIN" ? "🏆" : tx.type === "BONUS" ? "🎁" : tx.type === "WITHDRAWAL" ? "⬇️" : "🎯"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-txt-primary">{txTypeLabel(tx.type)}</p>
                      <p className="text-[11px] text-txt-muted">
                        {new Date(tx.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${
                      ["DEPOSIT", "WIN", "BONUS", "REFUND"].includes(tx.type) ? "text-green-400" : "text-live"
                    }`}>
                      {["DEPOSIT", "WIN", "BONUS", "REFUND"].includes(tx.type) ? "+" : "-"}
                      {formatXAF(Math.abs(Number(tx.amount)))}
                    </p>
                    <div className="flex justify-end mt-0.5">
                      {txStatusBadge(tx.status)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
