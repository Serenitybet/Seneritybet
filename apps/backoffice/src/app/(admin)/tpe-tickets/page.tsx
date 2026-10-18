"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

type Status = "PENDING" | "WON" | "LOST" | "REFUNDED" | "CANCELLED" | "PAID";

interface Ticket {
  id: string;
  code: string;
  status: Status;
  stakeXAF: number;
  totalOdds: number;
  potentialWinXAF: number;
  requiresApproval: boolean;
  approvedAt: string | null;
  createdAt: string;
  tpe: { code: string; name: string | null };
  cashier: { firstName: string; lastName: string };
}

interface Tpe { id: string; code: string; name: string | null }

const STATUS_LABEL: Record<Status, string> = {
  PENDING: "En cours", WON: "Gagnant", LOST: "Perdant", REFUNDED: "Remboursé", CANCELLED: "Annulé", PAID: "Payé",
};
const STATUS_BADGE: Record<Status, string> = {
  PENDING: "bo-badge-blue", WON: "bo-badge-green", LOST: "bo-badge-red",
  REFUNDED: "bo-badge-orange", CANCELLED: "bo-badge-gray", PAID: "bo-badge-yellow",
};

function fmtXAF(v: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(v)) + " XAF";
}

export default function TpeTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tpes, setTpes] = useState<Tpe[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [tpeId, setTpeId] = useState("");
  const [dangerousOnly, setDangerousOnly] = useState(false);
  const [groupByTpe, setGroupByTpe] = useState(false);

  function token() { return localStorage.getItem("bo_token"); }
  function authHeaders() { return { Authorization: `Bearer ${token()}` }; }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (tpeId) params.set("tpeId", tpeId);
      if (dangerousOnly) params.set("dangerous", "true");
      const [ticketsRes, tpesRes] = await Promise.all([
        fetch(`${API}/admin/tickets?${params}`, { headers: authHeaders() }),
        fetch(`${API}/admin/tpe`, { headers: authHeaders() }),
      ]);
      const td = await ticketsRes.json();
      const pd = await tpesRes.json();
      if (td.data) setTickets(td.data.tickets);
      if (pd.data) setTpes(pd.data);
    } catch { toast.error("Erreur de chargement"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [status, tpeId, dangerousOnly]);

  const grouped = useMemo(() => {
    if (!groupByTpe) return null;
    const map: Record<string, { label: string; tickets: Ticket[] }> = {};
    for (const t of tickets) {
      const key = t.tpe?.code ?? "—";
      if (!map[key]) map[key] = { label: t.tpe?.name ? `${t.tpe.name} (${key})` : key, tickets: [] };
      map[key].tickets.push(t);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [tickets, groupByTpe]);

  function isDangerous(t: Ticket) {
    return t.status === "WON" && t.requiresApproval && !t.approvedAt;
  }

  function TicketRow({ t }: { t: Ticket }) {
    return (
      <div className={`flex items-center justify-between gap-4 px-4 py-3 border-b border-bo-border last:border-b-0 ${isDangerous(t) ? "bg-red-500/5" : ""}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-mono font-bold text-t-primary text-sm">{t.code}</p>
            <span className={`${STATUS_BADGE[t.status]} text-[10px]`}>{STATUS_LABEL[t.status]}</span>
            {isDangerous(t) && <span className="bo-badge-red text-[10px]">⚠️ Dangereux</span>}
          </div>
          <p className="text-[11px] text-t-faint mt-0.5">
            {t.tpe?.name ?? t.tpe?.code} · {t.cashier?.firstName} {t.cashier?.lastName} · {new Date(t.createdAt).toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-t-faint">Mise {fmtXAF(t.stakeXAF)} · x{t.totalOdds.toFixed(2)}</p>
          <p className="font-black text-sm text-t-primary">{fmtXAF(t.potentialWinXAF)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bo-filter-bar flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-t-primary">🎫 Tickets TPE</h1>
          <p className="text-[11px] text-t-faint mt-0.5">{tickets.length} ticket(s)</p>
        </div>
        <select className="bo-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="PENDING">En cours</option>
          <option value="WON">Gagnant</option>
          <option value="LOST">Perdant</option>
          <option value="REFUNDED">Remboursé</option>
          <option value="PAID">Payé</option>
          <option value="CANCELLED">Annulé</option>
        </select>
        <select className="bo-select" value={tpeId} onChange={(e) => setTpeId(e.target.value)}>
          <option value="">Tous les TPE</option>
          {tpes.map((t) => <option key={t.id} value={t.id}>{t.name ?? t.code}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-t-muted cursor-pointer">
          <input type="checkbox" checked={dangerousOnly} onChange={(e) => setDangerousOnly(e.target.checked)} />
          ⚠️ Dangereux uniquement
        </label>
        <label className="flex items-center gap-1.5 text-xs text-t-muted cursor-pointer ml-auto">
          <input type="checkbox" checked={groupByTpe} onChange={(e) => setGroupByTpe(e.target.checked)} />
          Grouper par TPE
        </label>
      </div>

      {loading ? (
        <div className="bo-card p-12 text-center text-t-faint">Chargement…</div>
      ) : tickets.length === 0 ? (
        <div className="bo-card p-12 text-center text-t-faint">Aucun ticket ne correspond à ces filtres.</div>
      ) : grouped ? (
        <div className="space-y-3">
          {grouped.map(([key, g]) => (
            <div key={key} className="bo-card">
              <div className="bo-card-header">
                <span className="bo-card-title">🖥 {g.label}</span>
                <span className="text-[11px] text-t-faint">{g.tickets.length} ticket(s)</span>
              </div>
              <div>{g.tickets.map((t) => <TicketRow key={t.id} t={t} />)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bo-card">
          <div>{tickets.map((t) => <TicketRow key={t.id} t={t} />)}</div>
        </div>
      )}
    </div>
  );
}
