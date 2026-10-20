"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

interface Banner {
  id: string;
  imageUrl: string;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM = { imageUrl: "", title: "", subtitle: "", linkUrl: "", sortOrder: "0" };

export default function BannersPage() {
  const [banners, setBanners]     = useState<Banner[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Banner | null>(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);

  function token() { return localStorage.getItem("bo_token"); }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/banners`, { headers: { Authorization: `Bearer ${token()}` } });
      const d = await res.json();
      if (d.data) setBanners(d.data);
    } catch { toast.error("Erreur chargement"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sortOrder: String(banners.length) });
    setShowModal(true);
  }

  function openEdit(b: Banner) {
    setEditing(b);
    setForm({
      imageUrl: b.imageUrl,
      title: b.title ?? "",
      subtitle: b.subtitle ?? "",
      linkUrl: b.linkUrl ?? "",
      sortOrder: String(b.sortOrder),
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.imageUrl.trim()) { toast.error("URL de l'image requise"); return; }
    setSaving(true);
    try {
      const url    = editing ? `${API}/admin/banners/${editing.id}` : `${API}/admin/banners`;
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ ...form, sortOrder: Number(form.sortOrder) || 0 }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success(editing ? "Bannière mise à jour ✓" : "Bannière créée ✓");
      setShowModal(false);
      load();
    } catch { toast.error("Erreur réseau"); }
    finally { setSaving(false); }
  }

  async function toggleActive(b: Banner) {
    try {
      const res = await fetch(`${API}/admin/banners/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ isActive: !b.isActive }),
      });
      if (res.ok) { toast.success(`Bannière ${b.isActive ? "désactivée" : "activée"} ✓`); load(); }
      else toast.error("Erreur");
    } catch { toast.error("Erreur réseau"); }
  }

  async function handleDelete(b: Banner) {
    if (!confirm(`Supprimer la bannière "${b.title ?? b.imageUrl}" ?`)) return;
    try {
      const res = await fetch(`${API}/admin/banners/${b.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) { toast.success("Bannière supprimée ✓"); load(); }
      else toast.error("Erreur");
    } catch { toast.error("Erreur réseau"); }
  }

  return (
    <div className="space-y-4">
      <div className="bo-filter-bar flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-t-primary">📣 Bannières publicitaires</h1>
          <p className="text-[11px] text-t-faint mt-0.5">
            {banners.filter(b => b.isActive).length} active(s) · {banners.length} au total — carrousel en haut de la page d'accueil du site joueur
          </p>
        </div>
        <button className="bo-btn-primary flex items-center gap-1.5 ml-auto" onClick={openCreate}>
          <span>+</span> Ajouter une bannière
        </button>
      </div>

      {loading ? (
        <div className="bo-card p-12 text-center text-t-faint">Chargement…</div>
      ) : banners.length === 0 ? (
        <div className="bo-card p-12 text-center text-t-faint">
          <div className="text-4xl mb-2">📣</div>
          <p>Aucune bannière. Cliquez sur "Ajouter une bannière" pour commencer.</p>
        </div>
      ) : (
        <div className="bo-card">
          <div className="divide-y divide-bo-border">
            {banners.map((b) => (
              <div key={b.id} className={`flex items-center gap-4 p-4 ${!b.isActive ? "opacity-50" : ""}`}>
                <img src={b.imageUrl} alt={b.title ?? ""} className="w-28 h-16 object-cover rounded-lg bg-bo-surface border border-bo-border shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-t-primary truncate">{b.title || "(sans titre)"}</p>
                    <span className="text-[10px] text-t-faint">ordre {b.sortOrder}</span>
                    {!b.isActive && <span className="bo-badge-red text-[10px]">Inactive</span>}
                  </div>
                  {b.subtitle && <p className="text-xs text-t-faint truncate">{b.subtitle}</p>}
                  {b.linkUrl && <p className="text-[11px] text-green-400 truncate">🔗 {b.linkUrl}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="bo-btn-secondary bo-btn-sm" onClick={() => openEdit(b)}>✏️</button>
                  <button
                    className={`bo-btn-sm ${b.isActive ? "bo-btn-danger" : "bo-btn-primary"}`}
                    onClick={() => toggleActive(b)}
                  >
                    {b.isActive ? "🔴" : "✅"}
                  </button>
                  <button className="bo-btn-danger bo-btn-sm" onClick={() => handleDelete(b)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bo-card border border-bo-border rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-t-primary">
                {editing ? "✏️ Modifier la bannière" : "➕ Nouvelle bannière"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-t-faint hover:text-t-primary text-lg">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">URL de l'image *</label>
                <input className="bo-input w-full" required placeholder="https://..."
                  value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} />
                {form.imageUrl && (
                  <img src={form.imageUrl} alt="" className="mt-2 w-full h-28 object-cover rounded-lg bg-bo-surface border border-bo-border" />
                )}
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Titre</label>
                <input className="bo-input w-full" placeholder="Ex: Cotes boostées"
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Sous-titre</label>
                <input className="bo-input w-full" placeholder="Ex: Jusqu'au 31 octobre"
                  value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Lien (optionnel)</label>
                <input className="bo-input w-full" placeholder="https://... ou /promotions"
                  value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Ordre d'affichage</label>
                <input type="number" className="bo-input w-full" value={form.sortOrder}
                  onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="bo-btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={saving} className="bo-btn-primary flex-1">
                  {saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer la bannière"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
