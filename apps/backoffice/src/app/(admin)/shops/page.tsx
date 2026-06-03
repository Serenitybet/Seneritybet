"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

interface ShopStats {
  totalDepositsXAF: number;
  countDeposits: number;
  totalWithdrawalsXAF: number;
  countWithdrawals: number;
  pendingAmountXAF: number;
  countPending: number;
  balanceXAF: number;
}

interface Shop {
  id: string;
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  stats?: ShopStats;
}

const EMPTY_FORM = { name: "", city: "", address: "", phone: "" };

function fmtXAF(v: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(v)) + " XAF";
}

export default function ShopsPage() {
  const [shops, setShops]           = useState<Shop[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<Shop | null>(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [filterCity, setFilterCity] = useState("");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");

  function token() { return localStorage.getItem("bo_token"); }

  async function loadShops() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo)   params.set("to",   dateTo);
      const res = await fetch(`${API}/admin/shops?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
      const d = await res.json();
      if (d.data) setShops(d.data);
    } catch { toast.error("Erreur chargement"); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadShops(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(shop: Shop) {
    setEditing(shop);
    setForm({ name: shop.name, city: shop.city, address: shop.address ?? "", phone: shop.phone ?? "" });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url    = editing ? `${API}/admin/shops/${editing.id}` : `${API}/admin/shops`;
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success(editing ? "Boutique mise à jour ✓" : "Boutique créée ✓");
      setShowModal(false);
      loadShops();
    } catch { toast.error("Erreur réseau"); }
    finally { setSaving(false); }
  }

  async function toggleActive(shop: Shop) {
    const action = shop.isActive ? "désactiver" : "réactiver";
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} "${shop.name}" ?`)) return;
    try {
      const res = await fetch(`${API}/admin/shops/${shop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ isActive: !shop.isActive }),
      });
      if (res.ok) { toast.success(`Boutique ${shop.isActive ? "désactivée" : "réactivée"} ✓`); loadShops(); }
      else toast.error("Erreur");
    } catch { toast.error("Erreur réseau"); }
  }

  // Villes uniques pour le filtre
  const cities = [...new Set(shops.map(s => s.city))].sort();
  const filtered = filterCity ? shops.filter(s => s.city === filterCity) : shops;

  // Grouper par ville
  const byCity: Record<string, Shop[]> = {};
  for (const s of filtered) {
    if (!byCity[s.city]) byCity[s.city] = [];
    byCity[s.city].push(s);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bo-filter-bar flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-t-primary">🏪 Boutiques & Salles de jeux</h1>
          <p className="text-[11px] text-t-faint mt-0.5">
            {shops.filter(s => s.isActive).length} actives · {shops.length} au total
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" className="bo-input text-xs py-1.5" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Du" />
          <span className="text-t-faint text-xs">→</span>
          <input type="date" className="bo-input text-xs py-1.5" value={dateTo}   onChange={e => setDateTo(e.target.value)}   title="Au" />
          <button className="bo-btn-secondary bo-btn-sm" onClick={loadShops}>Filtrer</button>
          {(dateFrom || dateTo) && (
            <button className="bo-btn-secondary bo-btn-sm" onClick={() => { setDateFrom(""); setDateTo(""); setTimeout(loadShops, 0); }}>✕</button>
          )}
        </div>
        <select className="bo-select" value={filterCity} onChange={e => setFilterCity(e.target.value)}>
          <option value="">Toutes les villes</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="bo-btn-primary flex items-center gap-1.5" onClick={openCreate}>
          <span>+</span> Ajouter une boutique
        </button>
      </div>

      {/* Totaux globaux */}
      {shops.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total dépôts",    value: shops.reduce((s, sh) => s + (sh.stats?.totalDepositsXAF    ?? 0), 0), color: "text-green-400" },
            { label: "Total retraits",  value: shops.reduce((s, sh) => s + (sh.stats?.totalWithdrawalsXAF  ?? 0), 0), color: "text-red-400" },
            { label: "En attente",      value: shops.reduce((s, sh) => s + (sh.stats?.pendingAmountXAF     ?? 0), 0), color: "text-gold" },
            { label: "Balance globale", value: shops.reduce((s, sh) => s + (sh.stats?.balanceXAF           ?? 0), 0), color: "text-t-primary" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bo-card p-4 text-center">
              <p className="text-[10px] uppercase tracking-widest text-t-faint mb-1">{label}</p>
              <p className={`text-xl font-black ${color}`}>{fmtXAF(value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Liste par ville */}
      {loading ? (
        <div className="bo-card p-12 text-center text-t-faint">Chargement…</div>
      ) : Object.keys(byCity).length === 0 ? (
        <div className="bo-card p-12 text-center text-t-faint">
          <div className="text-4xl mb-2">🏪</div>
          <p>Aucune boutique. Cliquez sur "Ajouter une boutique" pour commencer.</p>
        </div>
      ) : (
        Object.entries(byCity).sort(([a], [b]) => a.localeCompare(b)).map(([city, cityShops]) => (
          <div key={city} className="bo-card">
            <div className="bo-card-header">
              <span className="bo-card-title">📍 {city}</span>
              <span className="text-[11px] text-t-faint">{cityShops.length} boutique(s)</span>
            </div>
            <div className="divide-y divide-bo-border">
              {cityShops.map(shop => {
                const s = shop.stats;
                // Dépôts non disponibles par boutique (non lié au shopId dans les transactions)
                // Retraits = montants validés à cette boutique
                const totalRetraits = s?.totalWithdrawalsXAF ?? 0;
                const enAttente    = s?.pendingAmountXAF    ?? 0;

                return (
                  <div key={shop.id} className={`p-4 ${!shop.isActive ? "opacity-50" : ""}`}>
                    {/* Ligne 1 : nom + actions */}
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-t-primary">{shop.name}</p>
                          {!shop.isActive && <span className="bo-badge-red text-[10px]">Inactive</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {shop.address && <span className="text-xs text-t-faint">📍 {shop.address}</span>}
                          {shop.phone   && <span className="text-xs text-t-faint">📞 {shop.phone}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button className="bo-btn-secondary bo-btn-sm" onClick={() => openEdit(shop)}>✏️</button>
                        <button
                          className={`bo-btn-sm ${shop.isActive ? "bo-btn-danger" : "bo-btn-primary"}`}
                          onClick={() => toggleActive(shop)}
                        >
                          {shop.isActive ? "🔴" : "✅"}
                        </button>
                      </div>
                    </div>

                    {/* Ligne 2 : rapport financier */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-bo-surface border border-bo-border rounded-lg px-3 py-2 text-center">
                        <p className="text-[10px] text-t-faint uppercase tracking-wide mb-0.5">Dépôts</p>
                        <p className="text-sm font-black text-green-400">{fmtXAF(s?.totalDepositsXAF ?? 0)}</p>
                        <p className="text-[10px] text-t-faint">{s?.countDeposits ?? 0} opération(s)</p>
                      </div>
                      <div className="bg-bo-surface border border-bo-border rounded-lg px-3 py-2 text-center">
                        <p className="text-[10px] text-t-faint uppercase tracking-wide mb-0.5">Retraits</p>
                        <p className="text-sm font-black text-red-400">{fmtXAF(s?.totalWithdrawalsXAF ?? 0)}</p>
                        <p className="text-[10px] text-t-faint">{s?.countWithdrawals ?? 0} opération(s)</p>
                      </div>
                      <div className="bg-bo-surface border border-bo-border rounded-lg px-3 py-2 text-center">
                        <p className="text-[10px] text-t-faint uppercase tracking-wide mb-0.5">En attente</p>
                        <p className="text-sm font-black text-gold">{fmtXAF(s?.pendingAmountXAF ?? 0)}</p>
                        <p className="text-[10px] text-t-faint">{s?.countPending ?? 0} demande(s)</p>
                      </div>
                      <div className={`bg-bo-surface border rounded-lg px-3 py-2 text-center ${(s?.balanceXAF ?? 0) >= 0 ? "border-green-600/30" : "border-red-500/30"}`}>
                        <p className="text-[10px] text-t-faint uppercase tracking-wide mb-0.5">Balance</p>
                        <p className={`text-sm font-black ${(s?.balanceXAF ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {(s?.balanceXAF ?? 0) >= 0 ? "+" : ""}{fmtXAF(s?.balanceXAF ?? 0)}
                        </p>
                        <p className="text-[10px] text-t-faint">dépôts − retraits</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Modal Créer / Modifier */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bo-card border border-bo-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-t-primary">
                {editing ? "✏️ Modifier la boutique" : "➕ Nouvelle boutique"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-t-faint hover:text-t-primary text-lg">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Nom de la boutique *</label>
                <input className="bo-input w-full" required placeholder="Ex: Serenitybet Farcha"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Ville *</label>
                <input className="bo-input w-full" required placeholder="Ex: N'Djamena, Moundou, Sarh…"
                  value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  list="cities-list" />
                <datalist id="cities-list">
                  {cities.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Adresse</label>
                <input className="bo-input w-full" placeholder="Ex: Quartier Farcha, Route de l'aéroport"
                  value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Téléphone</label>
                <input className="bo-input w-full" placeholder="Ex: +235 66 00 00 01"
                  value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="bo-btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={saving} className="bo-btn-primary flex-1">
                  {saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer la boutique"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
