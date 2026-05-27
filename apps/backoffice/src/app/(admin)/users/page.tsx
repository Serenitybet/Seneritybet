"use client";

import { useEffect, useState } from "react";
import { formatXAF } from "@serenitybet/shared";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL;

const DEMO_USERS = [
  { id: "1", initials: "MD", color: "text-blue-400   bg-blue-500/10",  username: "@mbaye_d",  name: "Mbaye Diop",    email: "mbaye.diop@email.com",   balance: 124000, total: 482000, bets: 47, status: "ACTIVE",    kyc: "APPROVED",  date: "12 jan 2026" },
  { id: "2", initials: "AH", color: "text-green-400  bg-green-500/10", username: "@ali_hass", name: "Ali Hassan",    email: "ali.hassan@email.com",   balance: 350000, total: 1240000, bets: 98, status: "ACTIVE",   kyc: "APPROVED",  date: "3 fév 2026" },
  { id: "3", initials: "FK", color: "text-orange-400 bg-orange-500/10",username: "@fatou_k",  name: "Fatou Koné",    email: "fatou.k@email.com",      balance: 78000,  total: 210000, bets: 23, status: "ACTIVE",    kyc: "PENDING",   date: "18 mar 2026" },
  { id: "4", initials: "JP", color: "text-red-400    bg-red-500/10",   username: "@jean_p",   name: "Jean Pierre",   email: "jean.pierre@email.com",  balance: 5000,   total: 89000,  bets: 15, status: "ACTIVE",    kyc: "REJECTED",  date: "22 avr 2026" },
  { id: "5", initials: "OS", color: "text-t-muted    bg-bo-surface",   username: "@omar_s",   name: "Omar Saleh",    email: "omar.saleh@email.com",   balance: 210000, total: 640000, bets: 62, status: "SUSPENDED", kyc: "APPROVED",  date: "5 jan 2026" },
  { id: "6", initials: "AM", color: "text-blue-400   bg-blue-500/10",  username: "@aisha_m",  name: "Aisha Moussa",  email: "aisha.m@email.com",      balance: 42000,  total: 180000, bets: 31, status: "ACTIVE",    kyc: "APPROVED",  date: "14 mar 2026" },
];

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

export default function UsersPage() {
  const [apiUsers, setApiUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [apiLoaded, setApiLoaded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("bo_token");
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (search) params.set("search", search);
    fetch(`${API}/admin/users?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { if (d.data?.users?.length) { setApiUsers(d.data.users); setTotal(d.data.total); setApiLoaded(true); } })
      .catch(() => {});
  }, [page, search]);

  async function updateStatus(userId: string, status: string) {
    const token = localStorage.getItem("bo_token");
    const res = await fetch(`${API}/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (res.ok) toast.success("Statut mis à jour ✓");
    else toast.error("Erreur");
  }

  const displayUsers = apiLoaded ? apiUsers : DEMO_USERS;

  return (
    <div className="space-y-4">
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
      </div>

      {/* Tableau */}
      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">👥 Parieurs inscrits</span>
          <span className="text-[11px] text-t-faint">{apiLoaded ? total : DEMO_USERS.length} comptes</span>
        </div>
        <table className="bo-table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Email</th>
              <th>Solde</th>
              <th>Total misé</th>
              <th>Paris</th>
              <th>KYC</th>
              <th>Statut</th>
              <th>Inscription</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayUsers.map((u: any) => {
              const initials = apiLoaded ? `${u.firstName?.[0]}${u.lastName?.[0]}`.toUpperCase() : u.initials;
              const name     = apiLoaded ? `${u.firstName} ${u.lastName}` : u.name;
              const email    = apiLoaded ? u.email : u.email;
              const balance  = apiLoaded ? Number(u.wallet?.balance ?? 0) : u.balance;
              const total_m  = apiLoaded ? 0 : u.total;
              const bets_c   = apiLoaded ? (u._count?.bets ?? 0) : u.bets;
              const status   = apiLoaded ? u.status : u.status;
              const kyc      = apiLoaded ? u.kycStatus : u.kyc;
              const date     = apiLoaded ? new Date(u.createdAt).toLocaleDateString("fr-FR") : u.date;
              const colorCls = u.color ?? "text-green-400 bg-green-500/10";

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
                  <td>{email}</td>
                  <td className="text-green-400 font-medium font-mono">{formatXAF(balance)}</td>
                  <td className="font-mono">{formatXAF(total_m)}</td>
                  <td>{bets_c}</td>
                  <td>{kycBadge(kyc)}</td>
                  <td>{statusBadge(status)}</td>
                  <td className="text-t-faint">{date}</td>
                  <td>
                    <div className="flex gap-1.5">
                      <button className="bo-btn-secondary bo-btn-sm" onClick={() => toast(`Profil de ${name}`)}>👁</button>
                      {status === "ACTIVE"
                        ? <button className="bo-btn-danger bo-btn-sm" onClick={() => { updateStatus(u.id, "SUSPENDED"); toast.error("Compte suspendu"); }}>🔒</button>
                        : <button className="bo-btn-primary bo-btn-sm" onClick={() => { updateStatus(u.id, "ACTIVE"); toast.success("Compte activé"); }}>✓</button>
                      }
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {apiLoaded && (
          <div className="flex justify-between items-center p-3 border-t border-bo-border">
            <span className="text-[11px] text-t-faint">Page {page} — {total} utilisateurs</span>
            <div className="flex gap-2">
              <button className="bo-btn-secondary bo-btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Préc.</button>
              <button className="bo-btn-secondary bo-btn-sm" disabled={apiUsers.length < 25} onClick={() => setPage(p => p + 1)}>Suiv. →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
