"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAuthAdminStore } from "@/store/auth-admin.store";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

type Status = "PENDING" | "WON" | "LOST" | "REFUNDED" | "CANCELLED" | "PAID";
type ItemResult = "WON" | "LOST" | "VOID" | null;

interface TicketItem {
  id: string;
  oddValue: number;
  result: ItemResult;
  odd: { label: string };
  market: { name: string; event: { homeTeam: string; awayTeam: string; startTime: string } };
}

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
  items: TicketItem[];
}

const RESULT_LABEL: Record<string, string> = { WON: "Gagné", LOST: "Perdu", VOID: "Annulé" };
const RESULT_BADGE: Record<string, string> = { WON: "bo-badge-green", LOST: "bo-badge-red", VOID: "bo-badge-gray" };

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
  const { admin } = useAuthAdminStore();
  const canSettle = admin?.role && ["TRADER", "ADMIN", "SUPER_ADMIN"].includes(admin.role);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tpes, setTpes] = useState<Tpe[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [tpeId, setTpeId] = useState("");
  const [dangerousOnly, setDangerousOnly] = useState(false);
  const [groupByTpe, setGroupByTpe] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function token() { return localStorage.getItem("bo_token"); }
  function authHeaders(extra?: Record<string, string>) { return { Authorization: `Bearer ${token()}`, ...extra }; }

  async function setItemResult(ticketId: string, itemId: string, result: "WON" | "LOST" | "VOID") {
    try {
      const res = await fetch(`${API}/admin/tickets/${ticketId}/result`, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ itemId, result }),
      });
      if (!res.ok) { toast.error("Erreur"); return; }
      await load();
    } catch { toast.error("Erreur réseau"); }
  }

  async function settleTicket(ticketId: string) {
    try {
      const res = await fetch(`${API}/admin/tickets/${ticketId}/settle`, {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success(`Ticket réglé : ${d.data.status}`);
      await load();
    } catch { toast.error("Erreur réseau"); }
  }

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
    const expanded = expandedId === t.id;
    const allHaveResults = t.items?.length > 0 && t.items.every((i) => i.result !== null);

    return (
      <div className={isDangerous(t) ? "bg-red-500/5" : ""}>
        <button
          onClick={() => setExpandedId(expanded ? null : t.id)}
          className="w-full flex items-center justify-between gap-4 px-4 py-3 border-b border-bo-border last:border-b-0 text-left hover:bg-bo-surface transition-colors"
        >
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
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[11px] text-t-faint">Mise {fmtXAF(t.stakeXAF)} · x{t.totalOdds.toFixed(2)}</p>
              <p className="font-black text-sm text-t-primary">{fmtXAF(t.potentialWinXAF)}</p>
            </div>
            <span className="text-t-faint text-xs">{expanded ? "▲" : "▼"}</span>
          </div>
        </button>

        {expanded && (
          <div className="px-4 pb-4 bg-bo-surface space-y-2 border-b border-bo-border">
            {(t.items ?? []).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 bg-bo-card border border-bo-border rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-t-primary truncate">
                    {item.market.event.homeTeam} vs {item.market.event.awayTeam}
                  </p>
                  <p className="text-[11px] text-t-faint">
                    {item.market.name} — {item.odd.label} @ {Number(item.oddValue).toFixed(2)}
                    {" · "}{new Date(item.market.event.startTime).toLocaleString("fr-FR")}
                  </p>
                </div>
                {item.result ? (
                  <span className={`${RESULT_BADGE[item.result]} text-[10px] shrink-0`}>{RESULT_LABEL[item.result]}</span>
                ) : canSettle && t.status === "PENDING" ? (
                  <div className="flex gap-1.5 shrink-0">
                    <button className="bo-btn-secondary bo-btn-sm" onClick={() => setItemResult(t.id, item.id, "WON")}>✅ Gagné</button>
                    <button className="bo-btn-secondary bo-btn-sm" onClick={() => setItemResult(t.id, item.id, "LOST")}>❌ Perdu</button>
                    <button className="bo-btn-secondary bo-btn-sm" onClick={() => setItemResult(t.id, item.id, "VOID")}>➖ Annulé</button>
                  </div>
                ) : (
                  <span className="text-[10px] text-t-faint shrink-0">En attente</span>
                )}
              </div>
            ))}

            {canSettle && t.status === "PENDING" && (
              <div className="flex justify-end pt-1">
                <button
                  className="bo-btn-primary bo-btn-sm"
                  disabled={!allHaveResults}
                  onClick={() => settleTicket(t.id)}
                >
                  {allHaveResults ? "Régler le ticket" : "En attente de tous les résultats"}
                </button>
              </div>
            )}
          </div>
        )}
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
