"use client";

import { useEffect, useState } from "react";
import { formatXAF } from "@serenitybet/shared";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";


function kycBadge(s: string) {
  if (s === "APPROVED") return <span className="bo-badge-green">✓ Vérifié</span>;
  if (s === "PENDING")  return <span className="bo-badge-orange">⏳ En attente</span>;
  if (s === "REJECTED") return <span className="bo-badge-red">✕ Rejeté</span>;
  return <span className="bo-badge-gray">{s}</span>;
}

function statusBadge(s: string) {
  if (s === "ACTIVE")    return <span className="bo-badge-green">Actif</span>;
  if (s === "SUSPENDED") return <span className="bo-badge-red">Suspendu</span>;
  return <span className="bo-badge-gray">{s}</span>;
}

const ROLE_LABELS: Record<string, string> = {
  CASHIER: "💰 Caissier",
  TRADER:  "📊 Trader",
  FINANCE: "💳 Finance",
  ADMIN:   "🛡️ Admin",
};

export default function UsersPage() {
  const [apiUsers, setApiUsers]   = useState<any[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
  const [apiLoaded, setApiLoaded] = useState(false);
  const [tab, setTab]             = useState<"players" | "staff">("players");
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating]   = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [loadingUser, setLoadingUser]   = useState(false);
  const [newPassword, setNewPassword]   = useState("");
  const [resetting, setResetting]       = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    password: "", role: "CASHIER", dateOfBirth: "1990-01-01", shopId: "",
  });
  const [shops, setShops] = useState<{id: string; name: string; city: string}[]>([]);

  function loadUsers() {
    const token = localStorage.getItem("bo_token");
    const url = tab === "staff"
      ? `${API}/admin/users/staff`
      : `${API}/admin/users?page=${page}&limit=25${search ? `&search=${encodeURIComponent(search)}` : ""}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        setApiUsers(d.data?.users ?? []);
        setTotal(d.data?.total ?? d.data?.users?.length ?? 0);
        setApiLoaded(true);
      })
      .catch(() => {
        // En cas d'erreur (token expiré, réseau...) on arrête le spinner
        setApiLoaded(true);
        setApiUsers([]);
      });
  }

  useEffect(() => { setApiUsers([]); setApiLoaded(false); loadUsers(); }, [page, search, tab]);

  useEffect(() => {
    const token = localStorage.getItem("bo_token");
    fetch(`${API}/admin/shops`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.data) setShops(d.data.map((s: any) => ({ id: s.id, name: s.name, city: s.city }))); })
      .catch(() => {});
  }, []);

  async function updateStatus(userId: string, status: string) {
    const token = localStorage.getItem("bo_token");
    const res = await fetch(`${API}/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { toast.success("Statut mis à jour ✓"); loadUsers(); }
    else toast.error("Erreur");
  }

  async function openUser(userId: string) {
    setLoadingUser(true);
    setSelectedUser(null);
    setNewPassword("");
    const token = localStorage.getItem("bo_token");
    try {
      const res = await fetch(`${API}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (d.data) setSelectedUser(d.data);
    } catch { toast.error("Impossible de charger le profil"); }
    finally { setLoadingUser(false); }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;
    setResetting(true);
    const token = localStorage.getItem("bo_token");
    try {
      const res = await fetch(`${API}/admin/users/${selectedUser.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword }),
      });
      const d = await res.json();
      if (res.ok) { toast.success("Mot de passe réinitialisé ✓"); setNewPassword(""); }
      else toast.error(d.error ?? "Erreur");
    } catch { toast.error("Erreur réseau"); }
    finally { setResetting(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const token = localStorage.getItem("bo_token");
      const res = await fetch(`${API}/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur création"); return; }
      toast.success(`✓ ${ROLE_LABELS[form.role]} créé : ${form.email}`);
      setShowModal(false);
      setForm({ firstName: "", lastName: "", email: "", phone: "", password: "", role: "CASHIER", dateOfBirth: "1990-01-01", shopId: "" });
      loadUsers();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setCreating(false);
    }
  }


  return (
    <div className="space-y-4">
      {/* Onglets */}
      <div className="flex gap-2 border-b border-bo-border pb-0">
        {[
          { key: "players", label: "👥 Joueurs" },
          { key: "staff",   label: "🛡️ Staff & Caissiers" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key as "players" | "staff"); setPage(1); }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all -mb-px ${
              tab === key
                ? "border-green-500 text-green-400"
                : "border-transparent text-t-faint hover:text-t-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="bo-filter-bar">
        <input
          className="bo-input flex-1"
          placeholder="Nom, email, username…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="bo-select">
          {["Tous","Vérifié (KYC)","Non vérifié","Suspendu"].map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="bo-btn-secondary">↓ Export</button>
        <button
          className="bo-btn-primary flex items-center gap-1.5"
          onClick={() => setShowModal(true)}
        >
          <span className="text-base leading-none">+</span>
          Créer utilisateur
        </button>
      </div>

      {/* Tableau */}
      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">
            {tab === "players" ? "👥 Parieurs inscrits" : "🛡️ Staff & Caissiers"}
          </span>
          <span className="text-[11px] text-t-faint">
            {apiLoaded ? `${total} compte(s)` : "Chargement…"}
          </span>
        </div>

        {/* État chargement */}
        {!apiLoaded && (
          <div className="p-12 text-center text-t-faint">
            <div className="w-6 h-6 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-3" />
            Chargement des données…
          </div>
        )}

        {/* État vide */}
        {apiLoaded && apiUsers.length === 0 && (
          <div className="p-12 text-center text-t-faint">
            <div className="text-4xl mb-2">{tab === "players" ? "👥" : "🛡️"}</div>
            <p className="font-semibold text-t-primary mb-1">
              {tab === "players" ? "Aucun parieur inscrit" : "Aucun membre du staff"}
            </p>
            <p className="text-sm">
              {tab === "players"
                ? "Les joueurs apparaîtront ici une fois inscrits sur le site."
                : "Créez votre premier caissier ou admin avec le bouton \"+ Créer utilisateur\"."}
            </p>
          </div>
        )}

        {/* Tableau des utilisateurs */}
        {apiLoaded && apiUsers.length > 0 && (
        <table className="bo-table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Email</th>
              {tab === "players" && <><th>Solde</th><th>Paris</th></>}
              {tab === "staff"   && <th>Boutique</th>}
              <th>KYC</th>
              <th>Statut</th>
              <th>Inscription</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {apiUsers.map((u: any) => {
              const initials = `${u.firstName?.[0] ?? "?"}${u.lastName?.[0] ?? ""}`.toUpperCase();
              const name     = `${u.firstName} ${u.lastName}`;
              const balance  = Number(u.wallet?.balance ?? 0);
              const bets_c   = u._count?.bets ?? 0;
              const colorCls = "text-green-400 bg-green-500/10";

              return (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${colorCls}`}>
                        {initials}
                      </div>
                      <div>
                        <p className="text-t-primary font-medium">{name}</p>
                        <p className="text-t-faint text-[10px]">{u.username ?? ""}</p>
                      </div>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  {tab === "players" && (
                    <>
                      <td className="text-green-400 font-medium font-mono">{formatXAF(balance)}</td>
                      <td>{bets_c}</td>
                    </>
                  )}
                  {tab === "staff" && (
                    <td className="text-xs text-t-muted">
                      {u.shop ? `🏪 ${u.shop.name}` : <span className="text-t-faint">—</span>}
                    </td>
                  )}
                  <td>{kycBadge(u.kycStatus)}</td>
                  <td>{statusBadge(u.status)}</td>
                  <td className="text-t-faint">{new Date(u.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td>
                    <div className="flex gap-1.5">
                      <button className="bo-btn-secondary bo-btn-sm" onClick={() => openUser(u.id)}>👁</button>
                      {u.status === "ACTIVE"
                        ? <button className="bo-btn-danger bo-btn-sm" onClick={() => updateStatus(u.id, "SUSPENDED")}>🔒</button>
                        : <button className="bo-btn-primary bo-btn-sm" onClick={() => updateStatus(u.id, "ACTIVE")}>✓</button>
                      }
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}

        {apiLoaded && apiUsers.length > 0 && (
          <div className="flex justify-between items-center p-3 border-t border-bo-border">
            <span className="text-[11px] text-t-faint">Page {page} — {total} utilisateur(s)</span>
            <div className="flex gap-2">
              <button className="bo-btn-secondary bo-btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Préc.</button>
              <button className="bo-btn-secondary bo-btn-sm" disabled={apiUsers.length < 25} onClick={() => setPage(p => p + 1)}>Suiv. →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Fiche joueur ── */}
      {(loadingUser || selectedUser) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bo-card border border-bo-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-t-primary">👤 Fiche utilisateur</h2>
              <button onClick={() => setSelectedUser(null)} className="text-t-faint hover:text-t-primary text-lg">✕</button>
            </div>

            {loadingUser ? (
              <div className="text-center py-8 text-t-faint">Chargement...</div>
            ) : selectedUser && (
              <div className="space-y-4">
                {/* Identité */}
                <div className="bg-bo-surface border border-bo-border rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-t-faint mb-0.5">Numéro joueur</p>
                    <p className="font-mono text-xl font-black text-green-400">#{selectedUser.playerNumber ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-t-faint mb-0.5">Inscription</p>
                    <p className="text-t-primary">{new Date(selectedUser.createdAt).toLocaleDateString("fr-FR", { day:"2-digit", month:"long", year:"numeric" })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-t-faint mb-0.5">Nom complet</p>
                    <p className="text-t-primary font-semibold">{selectedUser.firstName} {selectedUser.lastName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-t-faint mb-0.5">Email</p>
                    <p className="text-t-primary">{selectedUser.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-t-faint mb-0.5">Téléphone</p>
                    <p className="text-t-primary font-mono">{selectedUser.phone}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-t-faint mb-0.5">Rôle</p>
                    <p className="text-t-primary">{selectedUser.role}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-t-faint mb-0.5">Statut</p>
                    {statusBadge(selectedUser.status)}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-t-faint mb-0.5">KYC</p>
                    {kycBadge(selectedUser.kycStatus)}
                  </div>
                </div>

                {/* Solde */}
                {selectedUser.wallet && (
                  <div className="bg-green-600/10 border border-green-600/20 rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-t-faint mb-1">Solde disponible</p>
                    <p className="text-2xl font-black text-green-400">
                      {formatXAF(Number(selectedUser.wallet.balance))}
                    </p>
                    {selectedUser._count && (
                      <p className="text-xs text-t-faint mt-1">{selectedUser._count.bets} paris placés</p>
                    )}
                  </div>
                )}

                {/* Réinitialisation mot de passe */}
                <div className="border-t border-bo-border pt-4">
                  <p className="text-sm font-semibold text-t-primary mb-3">🔑 Réinitialiser le mot de passe</p>
                  <form onSubmit={resetPassword} className="flex gap-2">
                    <input
                      type="password"
                      className="bo-input flex-1"
                      placeholder="Nouveau mot de passe (6 car. min.)"
                      value={newPassword}
                      minLength={6}
                      required
                      onChange={e => setNewPassword(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={resetting}
                      className="bo-btn-primary shrink-0"
                    >
                      {resetting ? "..." : "Modifier"}
                    </button>
                  </form>
                  <p className="text-[11px] text-t-faint mt-1">Le mot de passe actuel ne sera pas affiché pour des raisons de sécurité.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Créer utilisateur ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bo-card border border-bo-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-t-primary">➕ Créer un utilisateur</h2>
              <button onClick={() => setShowModal(false)} className="text-t-faint hover:text-t-primary text-lg">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              {/* Rôle */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Rôle</label>
                <select
                  className="bo-select w-full"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  {Object.entries(ROLE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Nom / Prénom */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Prénom</label>
                  <input className="bo-input w-full" required value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Nom</label>
                  <input className="bo-input w-full" required value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Email</label>
                <input type="email" className="bo-input w-full" required value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>

              {/* Téléphone */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Téléphone (+235...)</label>
                <input type="tel" className="bo-input w-full" required value={form.phone}
                  placeholder="+23560000000"
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>

              {/* Boutique (obligatoire pour caissier) */}
              {form.role === "CASHIER" && (
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Boutique assignée *</label>
                  <select className="bo-select w-full" required value={form.shopId}
                    onChange={e => setForm(f => ({ ...f, shopId: e.target.value }))}>
                    <option value="">-- Choisir une boutique --</option>
                    {[...new Set(shops.map(s => s.city))].sort().map(city => (
                      <optgroup key={city} label={`📍 ${city}`}>
                        {shops.filter(s => s.city === city).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}

              {/* Mot de passe */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Mot de passe</label>
                <input type="password" className="bo-input w-full" required minLength={8} value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="bo-btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={creating}
                  className="bo-btn-primary flex-1">
                  {creating ? "Création…" : "Créer le compte"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
