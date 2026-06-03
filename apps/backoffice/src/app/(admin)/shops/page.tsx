"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

interface Shop {
  id: string;
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  _count?: { withdrawalRequests: number };
}

const EMPTY_FORM = { name: "", city: "", address: "", phone: "" };

export default function ShopsPage() {
  const [shops, setShops]         = useState<Shop[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Shop | null>(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [filterCity, setFilterCity] = useState("");

  function token() { return localStorage.getItem("bo_token"); }

  async function loadShops() {
    try {
      const res = await fetch(`${API}/admin/shops`, { headers: { Authorization: `Bearer ${token()}` } });
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
      <div className="bo-filter-bar">
        <div>
          <h1 className="text-lg font-bold text-t-primary">🏪 Boutiques & Salles de jeux</h1>
          <p className="text-[11px] text-t-faint mt-0.5">
            {shops.filter(s => s.isActive).length} actives · {shops.length} au total
          </p>
        </div>
        <select className="bo-select" value={filterCity} onChange={e => setFilterCity(e.target.value)}>
          <option value="">Toutes les villes</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="bo-btn-primary flex items-center gap-1.5" onClick={openCreate}>
          <span>+</span> Ajouter une boutique
        </button>
      </div>

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
              {cityShops.map(shop => (
                <div key={shop.id} className={`flex items-center gap-4 p-4 ${!shop.isActive ? "opacity-50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-t-primary">{shop.name}</p>
                      {!shop.isActive && (
                        <span className="bo-badge-red text-[10px]">Inactive</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {shop.address && <span className="text-xs text-t-faint">📍 {shop.address}</span>}
                      {shop.phone   && <span className="text-xs text-t-faint">📞 {shop.phone}</span>}
                      {shop._count && shop._count.withdrawalRequests > 0 && (
                        <span className="text-xs text-gold">💸 {shop._count.withdrawalRequests} demande(s)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      className="bo-btn-secondary bo-btn-sm"
                      onClick={() => openEdit(shop)}
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      className={`bo-btn-sm ${shop.isActive ? "bo-btn-danger" : "bo-btn-primary"}`}
                      onClick={() => toggleActive(shop)}
                    >
                      {shop.isActive ? "🔴 Désactiver" : "✅ Réactiver"}
                    </button>
                  </div>
                </div>
              ))}
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
