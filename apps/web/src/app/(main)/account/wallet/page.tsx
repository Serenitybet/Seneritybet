"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useWalletStore } from "@/store/wallet.store";
import { formatXAF, PAYMENT_PROVIDER_LABELS, type PaymentProvider } from "@serenitybet/shared";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://seneritybet.onrender.com/api";
const PROVIDERS: PaymentProvider[] = ["AIRTEL_MONEY", "ORANGE_MONEY", "MOOV_MONEY"];

const PROVIDER_META: Record<PaymentProvider, { color: string; bg: string; icon: string }> = {
  AIRTEL_MONEY: { color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",    icon: "📱" },
  ORANGE_MONEY: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", icon: "🟠" },
  MOOV_MONEY:   { color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",  icon: "💎" },
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

function wrStatusBadge(status: string) {
  const map: Record<string, { bg: string; label: string }> = {
    PENDING:   { bg: "bg-gold/20 text-gold",          label: "⏳ En attente" },
    VALIDATED: { bg: "bg-green-600/20 text-green-400", label: "✅ Validé" },
    CANCELLED: { bg: "bg-bg-hover text-txt-muted",     label: "Annulé" },
    EXPIRED:   { bg: "bg-live/10 text-live",           label: "Expiré" },
  };
  const s = map[status] ?? { bg: "bg-bg-hover text-txt-muted", label: status };
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${s.bg}`}>{s.label}</span>;
}

interface Shop { id: string; name: string; city: string; address: string | null; phone: string | null; }
interface WithdrawalReq {
  id: string; requestCode: string; amountXAF: number; status: string;
  shop: { name: string; city: string }; createdAt: string; expiresAt: string;
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

  // Retrait espèces
  const [cities, setCities] = useState<Record<string, Shop[]>>({});
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedShop, setSelectedShop] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [myRequests, setMyRequests] = useState<WithdrawalReq[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [successReq, setSuccessReq] = useState<any | null>(null);

  const token = () => localStorage.getItem("accessToken");

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetchBalance();
  }, [user]);

  useEffect(() => {
    if (tab === "history") loadTransactions();
    if (tab === "withdraw") { loadShops(); loadMyRequests(); }
  }, [tab]);

  async function loadShops() {
    try {
      const res = await fetch(`${API}/withdrawals/shops`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await res.json();
      if (d.data?.cities) setCities(d.data.cities);
    } catch { /* ignore */ }
  }

  async function loadMyRequests() {
    setReqLoading(true);
    try {
      const res = await fetch(`${API}/withdrawals/my`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await res.json();
      if (d.data) setMyRequests(d.data);
    } catch { /* ignore */ }
    finally { setReqLoading(false); }
  }

  async function handleWithdrawRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedShop || !withdrawAmount) return;
    setWithdrawLoading(true);
    setSuccessReq(null);
    try {
      const res = await fetch(`${API}/withdrawals/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          shopId: selectedShop,
          amount: parseInt(withdrawAmount) * 100, // XAF → centimes
        }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      setSuccessReq(d.data);
      fetchBalance();
      loadMyRequests();
      setWithdrawAmount("");
      setSelectedShop("");
      setSelectedCity("");
    } catch { toast.error("Erreur réseau"); }
    finally { setWithdrawLoading(false); }
  }

  async function cancelRequest(id: string) {
    if (!confirm("Annuler cette demande de retrait ?")) return;
    try {
      const res = await fetch(`${API}/withdrawals/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await res.json();
      if (res.ok) { toast.success("Demande annulée — montant remboursé"); fetchBalance(); loadMyRequests(); }
      else toast.error(d.error ?? "Erreur");
    } catch { toast.error("Erreur réseau"); }
  }

  async function loadTransactions() {
    setTxLoading(true);
    try {
      const res = await fetch(`${API}/wallet/transactions`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) { const d = await res.json(); setTransactions(d.data?.transactions ?? []); }
    } catch { /* ignore */ }
    finally { setTxLoading(false); }
  }

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/wallet/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ amount: parseInt(form.amount) * 100, provider: form.provider, phoneNumber: form.phone }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success(d.data?.message ?? "Dépôt initié ✓");
      fetchBalance();
      setForm((f) => ({ ...f, amount: "" }));
    } catch { toast.error("Erreur réseau"); }
    finally { setLoading(false); }
  }

  if (!user) return null;

  const TABS = [
    { id: "deposit",  label: "Dépôt",   icon: "⬆️" },
    { id: "withdraw", label: "Retrait",  icon: "💸" },
    { id: "history",  label: "Historique", icon: "📋" },
  ] as const;

  const shopsInCity = selectedCity ? (cities[selectedCity] ?? []) : [];

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-txt-muted hover:text-txt-primary transition-colors text-sm">
          ← Retour
        </button>
        <h1 className="text-lg font-black text-txt-primary">Portefeuille</h1>
      </div>

      {/* Solde */}
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-txt-muted mb-0.5">Solde disponible</p>
            <p className="text-3xl font-black text-green-400">{formatXAF(balance)}</p>
            {bonusBalance > 0 && (
              <p className="text-xs text-gold mt-1 flex items-center gap-1"><span>🎁</span> {formatXAF(bonusBalance)} en bonus</p>
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
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
              tab === t.id
                ? "bg-green-600/20 border-green-600/40 text-green-400"
                : "bg-bg-card border-bg-border text-txt-muted hover:text-txt-primary"
            }`}>
            <span className="text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Onglet Dépôt ── */}
      {tab === "deposit" && (
        <form onSubmit={handleDeposit} className="bg-bg-secondary border border-bg-border rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-2">Opérateur Mobile Money</label>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map((p) => {
                const meta = PROVIDER_META[p];
                return (
                  <button key={p} type="button" onClick={() => setForm((f) => ({ ...f, provider: p }))}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      form.provider === p ? `${meta.bg} ${meta.color}` : "bg-bg-card border-bg-border text-txt-muted hover:border-bg-hover"
                    }`}>
                    <span className="text-base">{meta.icon}</span>
                    <span>{PAYMENT_PROVIDER_LABELS[p].split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">Numéro {PAYMENT_PROVIDER_LABELS[form.provider]}</label>
            <div className="flex gap-2">
              <div className="flex items-center px-3 bg-bg-input border border-bg-border rounded-lg text-txt-muted text-sm shrink-0">🇹🇩 +235</div>
              <input type="tel" className="field flex-1" placeholder="XX XX XX XX" value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">Montant (XAF)</label>
            <input type="number" className="field text-lg font-bold" placeholder="Min. 500 XAF" value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} min={500} required />
            <div className="flex gap-1.5 mt-2">
              {[1000, 2000, 5000, 10000].map((v) => (
                <button key={v} type="button" onClick={() => setForm((f) => ({ ...f, amount: String(v) }))}
                  className="flex-1 py-1.5 text-[11px] font-semibold bg-bg-card border border-bg-border rounded-lg text-txt-muted hover:text-green-400 hover:border-green-600/40 transition-all">
                  {v / 1000}k
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="btn-green w-full py-3 text-sm font-bold" disabled={loading}>
            {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Traitement…</span> : "💳 Déposer maintenant"}
          </button>
        </form>
      )}

      {/* ── Onglet Retrait espèces ── */}
      {tab === "withdraw" && (
        <div className="space-y-4">
          {/* Confirmation de demande créée */}
          {successReq && (
            <div className="bg-green-600/10 border border-green-600/30 rounded-2xl p-5">
              <p className="text-green-400 font-bold text-base mb-3">✅ Demande créée avec succès !</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-txt-muted">Code de retrait</span>
                  <span className="font-mono text-2xl font-black text-green-400">#{successReq.requestCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-txt-muted">Montant</span>
                  <span className="font-bold text-txt-primary">{successReq.amountXAF.toLocaleString("fr-FR")} XAF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-txt-muted">Boutique</span>
                  <span className="font-semibold text-txt-primary">{successReq.shop.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-txt-muted">Expire</span>
                  <span className="text-txt-muted">{new Date(successReq.expiresAt).toLocaleString("fr-FR")}</span>
                </div>
              </div>
              <div className="mt-3 p-3 bg-gold/10 border border-gold/20 rounded-lg">
                <p className="text-xs text-gold">
                  📍 Rendez-vous à <strong>{successReq.shop.name}</strong> avec votre code <strong>#{successReq.requestCode}</strong>.
                  Le caissier validera votre retrait.
                </p>
              </div>
              <button onClick={() => setSuccessReq(null)} className="mt-3 w-full py-2 text-sm text-txt-muted hover:text-txt-primary border border-bg-border rounded-xl">
                Faire une autre demande
              </button>
            </div>
          )}

          {/* Formulaire de demande */}
          {!successReq && (
            <form onSubmit={handleWithdrawRequest} className="bg-bg-secondary border border-bg-border rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-sm font-bold text-txt-primary mb-1">💸 Retrait espèces en boutique</p>
                <p className="text-xs text-txt-muted">Choisissez la ville et la boutique où vous souhaitez retirer vos fonds.</p>
              </div>

              {/* Ville + Boutique sur la même ligne */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Ville</label>
                  <select className="field" value={selectedCity}
                    onChange={(e) => { setSelectedCity(e.target.value); setSelectedShop(""); }} required>
                    <option value="">-- Ville --</option>
                    {Object.keys(cities).sort().map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Boutique</label>
                  <select className="field" value={selectedShop}
                    onChange={(e) => setSelectedShop(e.target.value)}
                    required disabled={!selectedCity}>
                    <option value="">-- Boutique --</option>
                    {shopsInCity.map((shop) => (
                      <option key={shop.id} value={shop.id}>{shop.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Infos boutique sélectionnée */}
              {selectedShop && (() => {
                const shop = shopsInCity.find(s => s.id === selectedShop);
                return shop ? (
                  <div className="flex items-center gap-2 text-xs text-txt-muted bg-bg-card border border-bg-border rounded-lg px-3 py-2">
                    <span>📍</span>
                    <span>{shop.address ?? shop.city}</span>
                    {shop.phone && <><span>·</span><span>📞 {shop.phone}</span></>}
                  </div>
                ) : null;
              })()}

              {/* Montant */}
              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1.5">Montant (XAF)</label>
                <input type="number" className="field text-lg font-bold" placeholder="Min. 1 000 XAF"
                  value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} min={1000} max={500000} required />
                <div className="flex gap-1.5 mt-2">
                  {[1000, 2500, 5000, 10000, 25000, 50000].map((v) => (
                    <button key={v} type="button" onClick={() => setWithdrawAmount(String(v))}
                      className="flex-1 py-1.5 text-[11px] font-semibold bg-bg-card border border-bg-border rounded-lg text-txt-muted hover:text-green-400 hover:border-green-600/40 transition-all">
                      {v >= 1000 ? `${v / 1000}k` : v}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-txt-muted mt-1">
                  Disponible : {formatXAF(balance)} · Min 1 000 XAF · Max 500 000 XAF
                </p>
              </div>

              <div className="flex items-start gap-2 bg-gold/5 border border-gold/20 rounded-lg p-3">
                <span className="text-sm shrink-0">ℹ️</span>
                <p className="text-[11px] text-txt-muted leading-relaxed">
                  Le montant sera réservé sur votre compte dès la demande. Rendez-vous en boutique avec votre <strong>code de retrait</strong> dans les <strong>24 heures</strong>.
                </p>
              </div>

              <button type="submit" className="btn-green w-full py-3 text-sm font-bold"
                disabled={withdrawLoading || !selectedShop || !withdrawAmount}>
                {withdrawLoading
                  ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Traitement…</span>
                  : "💸 Confirmer la demande"}
              </button>
            </form>
          )}

          {/* Mes demandes en cours */}
          <div className="bg-bg-secondary border border-bg-border rounded-2xl p-5">
            <p className="text-sm font-bold text-txt-primary mb-3">📋 Mes demandes de retrait</p>
            {reqLoading ? (
              <div className="text-center py-4 text-txt-muted text-sm">Chargement…</div>
            ) : myRequests.length === 0 ? (
              <div className="text-center py-6 text-txt-muted text-sm">Aucune demande</div>
            ) : (
              <div className="space-y-2">
                {myRequests.map((r) => (
                  <div key={r.id} className="bg-bg-card border border-bg-border rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono font-black text-green-400">#{r.requestCode}</span>
                        <span className="font-bold text-txt-primary">{r.amountXAF.toLocaleString("fr-FR")} XAF</span>
                        {wrStatusBadge(r.status)}
                      </div>
                      <p className="text-xs text-txt-muted truncate">{r.shop.name} — {r.shop.city}</p>
                      <p className="text-[10px] text-txt-faint">
                        {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                        {r.status === "PENDING" && ` · Expire ${new Date(r.expiresAt).toLocaleString("fr-FR")}`}
                      </p>
                    </div>
                    {r.status === "PENDING" && (
                      <button onClick={() => cancelRequest(r.id)}
                        className="shrink-0 text-xs text-live hover:text-red-400 border border-live/30 hover:border-red-400/50 rounded-lg px-2 py-1 transition-all">
                        Annuler
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Onglet Historique ── */}
      {tab === "history" && (
        <div className="space-y-2">
          {txLoading ? (
            <div className="space-y-2">
              {[1,2,3].map((i) => (
                <div key={i} className="bg-bg-card border border-bg-border rounded-xl p-4 animate-pulse">
                  <div className="flex justify-between"><div className="h-3 bg-bg-hover rounded w-1/3" /><div className="h-3 bg-bg-hover rounded w-1/5" /></div>
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
                      ["DEPOSIT","WIN","BONUS","REFUND"].includes(tx.type) ? "bg-green-600/20 text-green-400" : "bg-live/10 text-live"
                    }`}>
                      {tx.type === "DEPOSIT" ? "⬆️" : tx.type === "WIN" ? "🏆" : tx.type === "BONUS" ? "🎁" : tx.type === "WITHDRAWAL" ? "⬇️" : "🎯"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-txt-primary">{txTypeLabel(tx.type)}</p>
                      <p className="text-[11px] text-txt-muted">
                        {new Date(tx.createdAt).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${["DEPOSIT","WIN","BONUS","REFUND"].includes(tx.type) ? "text-green-400" : "text-live"}`}>
                      {["DEPOSIT","WIN","BONUS","REFUND"].includes(tx.type) ? "+" : "-"}{formatXAF(Math.abs(Number(tx.amount)))}
                    </p>
                    <div className="flex justify-end mt-0.5">{txStatusBadge(tx.status)}</div>
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
