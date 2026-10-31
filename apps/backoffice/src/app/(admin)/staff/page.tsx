"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuthAdminStore } from "@/store/auth-admin.store";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

type Role = "CASHIER" | "TRADER" | "FINANCE" | "ADMIN" | "SUPER_ADMIN";

// Même hiérarchie que côté backend (voir users.routes.ts) — un ADMIN ne peut
// pas agir sur un autre ADMIN ni sur un SUPER_ADMIN ; seul un SUPER_ADMIN le
// peut. On s'en sert ici pour masquer les actions interdites plutôt que de
// laisser l'appel API échouer silencieusement.
const ROLE_RANK: Record<Role, number> = { CASHIER: 1, TRADER: 2, FINANCE: 2, ADMIN: 3, SUPER_ADMIN: 4 };
function canManage(actorRole: Role | undefined, targetRole: Role): boolean {
  if (!actorRole) return false;
  if (actorRole === "SUPER_ADMIN") return true;
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}

interface Staff {
  id: string;
  playerNumber: number;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
  createdAt: string;
  cashierCode: string | null;
}

const ROLE_LABEL: Record<Role, string> = {
  CASHIER: "Caissier",
  TRADER: "Trader",
  FINANCE: "Finance",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};
const ROLE_BADGE: Record<Role, string> = {
  CASHIER: "bo-badge-blue",
  TRADER: "bo-badge-orange",
  FINANCE: "bo-badge-green",
  ADMIN: "bo-badge-yellow",
  SUPER_ADMIN: "bo-badge-red",
};
const ROLES: Role[] = ["CASHIER", "TRADER", "FINANCE", "ADMIN", "SUPER_ADMIN"];

const EMPTY_FORM = { email: "", phone: "", firstName: "", lastName: "", password: "", role: "CASHIER" as Role, cashierCode: "" };

export default function StaffPage() {
  const actorRole = useAuthAdminStore((s) => s.admin?.role) as Role | undefined;
  const actorId = useAuthAdminStore((s) => s.admin?.id);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [roleEditId, setRoleEditId] = useState<string | null>(null);

  function token() { return localStorage.getItem("bo_token"); }
  function authHeaders(extra?: Record<string, string>) {
    return { Authorization: `Bearer ${token()}`, ...extra };
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`${API}/admin/users/staff?${params}`, { headers: authHeaders() });
      const d = await res.json();
      if (d.data) setStaff(d.data.users);
    } catch { toast.error("Erreur de chargement"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/users`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ...form, dateOfBirth: "1990-01-01" }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success("Utilisateur créé ✓");
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch { toast.error("Erreur réseau"); }
    finally { setSaving(false); }
  }

  async function changeRole(s: Staff, role: Role) {
    if (role === s.role) { setRoleEditId(null); return; }
    if (!confirm(`Changer le rôle de ${s.firstName} ${s.lastName} en "${ROLE_LABEL[role]}" ?`)) { setRoleEditId(null); return; }
    try {
      const res = await fetch(`${API}/admin/users/${s.id}/role`, {
        method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ role }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success("Rôle mis à jour ✓");
      load();
    } catch { toast.error("Erreur réseau"); }
    finally { setRoleEditId(null); }
  }

  async function editCashierCode(s: Staff) {
    const input = prompt(`Code de connexion TPE pour ${s.firstName} ${s.lastName} (3 à 12 lettres/chiffres) :`, s.cashierCode ?? "");
    if (input === null) return;
    try {
      const res = await fetch(`${API}/admin/users/${s.id}/cashier-code`, {
        method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ cashierCode: input }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success("Code mis à jour ✓");
      load();
    } catch { toast.error("Erreur réseau"); }
  }

  async function toggleStatus(s: Staff) {
    const next = s.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    if (!confirm(`${next === "SUSPENDED" ? "Suspendre" : "Réactiver"} ${s.firstName} ${s.lastName} ?`)) return;
    try {
      const res = await fetch(`${API}/admin/users/${s.id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) { toast.success("Statut mis à jour ✓"); load(); }
      else toast.error("Erreur");
    } catch { toast.error("Erreur réseau"); }
  }

  return (
    <div className="space-y-4">
      <div className="bo-filter-bar flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-t-primary">🧑‍💼 Équipe backoffice</h1>
          <p className="text-[11px] text-t-faint mt-0.5">{staff.length} membre(s) — caissiers, traders, finance, admins</p>
        </div>
        <input
          className="bo-input"
          placeholder="Rechercher (nom, email, téléphone)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <button className="bo-btn-secondary bo-btn-sm" onClick={load}>Filtrer</button>
        <button className="bo-btn-primary flex items-center gap-1.5 ml-auto" onClick={() => setShowModal(true)}>
          <span>+</span> Nouvel utilisateur
        </button>
      </div>

      <div className="bo-card">
        {loading ? (
          <div className="p-12 text-center text-t-faint">Chargement…</div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center text-t-faint">Aucun membre d'équipe pour l'instant.</div>
        ) : (
          <div className="divide-y divide-bo-border">
            {staff.map((s) => {
              const isSelf = s.id === actorId;
              const manageable = !isSelf && canManage(actorRole, s.role);
              return (
              <div key={s.id} className={`p-4 flex items-center justify-between gap-4 flex-wrap ${s.status === "SUSPENDED" ? "opacity-50" : ""}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-t-primary">{s.firstName} {s.lastName}</p>
                    {roleEditId === s.id ? (
                      <select
                        autoFocus
                        className="bo-select bo-btn-sm"
                        defaultValue={s.role}
                        onBlur={() => setRoleEditId(null)}
                        onChange={(e) => changeRole(s, e.target.value as Role)}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    ) : manageable && actorRole === "SUPER_ADMIN" ? (
                      <button className={`${ROLE_BADGE[s.role]} text-[10px]`} onClick={() => setRoleEditId(s.id)} title="Changer le rôle">
                        {ROLE_LABEL[s.role]} ✏️
                      </button>
                    ) : (
                      <span className={`${ROLE_BADGE[s.role]} text-[10px]`}>{ROLE_LABEL[s.role]}</span>
                    )}
                    {s.status === "SUSPENDED" && <span className="bo-badge-red text-[10px]">Suspendu</span>}
                    {isSelf && <span className="bo-badge-blue text-[10px]">Vous</span>}
                  </div>
                  <p className="text-xs text-t-faint mt-0.5">
                    {s.email} · {s.phone}
                    {s.role === "CASHIER" && (
                      <> · Code TPE : <span className="font-mono font-bold text-t-primary">{s.cashierCode ?? "—"}</span></>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {s.role === "CASHIER" && manageable && (
                    <button className="bo-btn-secondary bo-btn-sm" onClick={() => editCashierCode(s)}>🔑 Code TPE</button>
                  )}
                  {manageable && (
                    <button
                      className={`bo-btn-sm ${s.status === "SUSPENDED" ? "bo-btn-primary" : "bo-btn-danger"}`}
                      onClick={() => toggleStatus(s)}
                    >
                      {s.status === "SUSPENDED" ? "✅ Réactiver" : "🔴 Suspendre"}
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-bo-card border border-bo-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-t-primary">➕ Nouvel utilisateur backoffice</h2>
              <button onClick={() => setShowModal(false)} className="text-t-faint hover:text-t-primary text-lg">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Prénom *</label>
                  <input className="bo-input w-full" required value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Nom *</label>
                  <input className="bo-input w-full" required value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Email *</label>
                <input className="bo-input w-full" type="email" required value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Téléphone *</label>
                <input className="bo-input w-full" required placeholder="+235 66 00 00 00" value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Mot de passe *</label>
                <input className="bo-input w-full" type="password" required minLength={8} value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Rôle *</label>
                <select className="bo-select w-full" value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
                  <option value="CASHIER">Caissier</option>
                  <option value="TRADER">Trader</option>
                  <option value="FINANCE">Finance</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              {form.role === "CASHIER" && (
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-t-faint mb-1.5">Code de connexion TPE *</label>
                  <input className="bo-input w-full font-mono uppercase" required minLength={3} maxLength={12}
                    placeholder="Ex: MARIE1"
                    value={form.cashierCode}
                    onChange={(e) => setForm((f) => ({ ...f, cashierCode: e.target.value.toUpperCase() }))} />
                  <p className="text-[11px] text-t-faint mt-1">
                    Utilisé à la place de l'email pour se connecter sur un TPE (apps/pos) — 3 à 12 lettres/chiffres.
                  </p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="bo-btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={saving} className="bo-btn-primary flex-1">
                  {saving ? "Création…" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
