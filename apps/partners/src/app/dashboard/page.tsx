"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://seneritybet.onrender.com/api";

export default function DashboardPage() {
  const router = useRouter();
  const [partner, setPartner] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdraw, setWithdraw] = useState({ amount: "", method: "Airtel Money", account: "" });

  function token() { return localStorage.getItem("partner_token"); }

  useEffect(() => {
    const stored = localStorage.getItem("partner");
    if (!stored || !token()) { router.replace("/login"); return; }
    setPartner(JSON.parse(stored));

    fetch(`${API}/partners/me`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => {
        if (d.data) {
          setPartner(d.data.partner);
          setStats(d.data.stats);
          setCommissions(d.data.recentCommissions ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (parseFloat(withdraw.amount) < 1000) { toast.error("Minimum 1 000 XAF"); return; }
    try {
      const res = await fetch(`${API}/partners/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(withdraw),
      });
      const d = await res.json();
      if (res.ok) { toast.success("Demande de retrait envoyée ✓"); setShowWithdraw(false); }
      else toast.error(d.error ?? "Erreur");
    } catch { toast.error("Erreur réseau"); }
  }

  function logout() {
    localStorage.removeItem("partner_token");
    localStorage.removeItem("partner");
    router.push("/");
  }

  if (!partner) return null;

  const kpis = [
    { icon: "👥", label: "Filleuls actifs",    value: stats?.totalReferrals ?? 0,                              color: "text-blue-400" },
    { icon: "💰", label: "Commissions totales", value: `${(stats?.totalEarned ?? 0).toLocaleString("fr-FR")} XAF`, color: "text-green-400" },
    { icon: "💳", label: "Solde disponible",    value: `${(stats?.balance ?? 0).toLocaleString("fr-FR")} XAF`,    color: "text-gold" },
    { icon: "📈", label: "Ce mois-ci",          value: `${(stats?.thisMonth ?? 0).toLocaleString("fr-FR")} XAF`,  color: "text-purple-400" },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center font-black text-white text-sm">S</div>
          <span className="font-black text-white"><span className="text-green-400">Serenity</span>bet Partners</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{partner.firstName} {partner.lastName}</span>
          <button onClick={logout} className="text-xs text-gray-500 hover:text-red-400 border border-gray-700 px-3 py-1.5 rounded-lg">
            Déconnexion
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Code promo */}
        <div className="bg-gradient-to-r from-green-900/40 to-green-600/20 border border-green-600/30 rounded-2xl p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-green-300 mb-1">Votre code promo personnel</p>
            <p className="text-4xl font-black text-white font-mono tracking-widest">{partner.promoCode}</p>
            <p className="text-xs text-green-400 mt-2">
              Commission : <strong>{((partner.commissionRate ?? 0.10) * 100).toFixed(0)}%</strong> sur les pertes nettes de vos filleuls
            </p>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(partner.promoCode); toast.success("Code copié !"); }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-sm">
            📋 Copier
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(k => (
            <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="text-2xl mb-2">{k.icon}</div>
              <p className="text-xs text-gray-500 mb-1">{k.label}</p>
              <p className={`text-xl font-black ${k.color}`}>{loading ? "…" : k.value}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={() => setShowWithdraw(true)}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-sm">
            💳 Demander un retrait
          </button>
          <button onClick={() => {
            const link = `https://serenitybet.africa/register?ref=${partner.promoCode}`;
            navigator.clipboard.writeText(link);
            toast.success("Lien d'affiliation copié !");
          }}
            className="flex-1 border border-gray-700 hover:border-green-600/50 text-gray-300 font-semibold py-3 rounded-xl text-sm">
            🔗 Copier mon lien
          </button>
        </div>

        {/* Commissions récentes */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-bold text-white">💸 Commissions récentes</h2>
            <span className="text-xs text-gray-500">{commissions.length} opérations</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Chargement…</div>
          ) : commissions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-3xl mb-2">💤</p>
              <p className="text-gray-500 text-sm">Partagez votre code pour commencer à gagner !</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-800">
                <tr>
                  <th className="text-left px-5 py-3 text-gray-400 font-medium">Date</th>
                  <th className="text-left px-5 py-3 text-gray-400 font-medium">Description</th>
                  <th className="text-right px-5 py-3 text-gray-400 font-medium">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {commissions.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-800/50">
                    <td className="px-5 py-3 text-gray-400">{new Date(c.createdAt).toLocaleDateString("fr-FR")}</td>
                    <td className="px-5 py-3 text-white">{c.description ?? "Commission filleul"}</td>
                    <td className="px-5 py-3 text-right font-bold text-green-400">
                      +{c.amount.toLocaleString("fr-FR")} XAF
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal retrait */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-white">💳 Demande de retrait</h3>
              <button onClick={() => setShowWithdraw(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Solde disponible</label>
                <p className="text-2xl font-black text-green-400">{(stats?.balance ?? 0).toLocaleString("fr-FR")} XAF</p>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Montant (min. 1 000 XAF)</label>
                <input type="number" min={1000} required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-white focus:border-green-500 focus:outline-none"
                  value={withdraw.amount} onChange={e => setWithdraw(w => ({ ...w, amount: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Méthode de paiement</label>
                <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-white focus:border-green-500 focus:outline-none"
                  value={withdraw.method} onChange={e => setWithdraw(w => ({ ...w, method: e.target.value }))}>
                  <option>Airtel Money</option>
                  <option>Orange Money</option>
                  <option>Moov Money (Flooz)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Numéro de compte</label>
                <input type="tel" required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-white focus:border-green-500 focus:outline-none"
                  value={withdraw.account} onChange={e => setWithdraw(w => ({ ...w, account: e.target.value }))}
                  placeholder="+23592767036" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowWithdraw(false)}
                  className="flex-1 border border-gray-700 text-gray-300 py-3 rounded-xl font-semibold">Annuler</button>
                <button type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl">
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
