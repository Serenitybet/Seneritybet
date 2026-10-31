"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { useAuthAdminStore } from "@/store/auth-admin.store";

const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";

type Status = "PENDING" | "WON" | "LOST" | "REFUNDED" | "CANCELLED" | "PAID" | "CASHED_OUT_PENDING";
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
  CASHED_OUT_PENDING: "Cash-out accepté",
};
const STATUS_BADGE: Record<Status, string> = {
  PENDING: "bo-badge-blue", WON: "bo-badge-green", LOST: "bo-badge-red",
  REFUNDED: "bo-badge-orange", CANCELLED: "bo-badge-gray", PAID: "bo-badge-yellow",
  CASHED_OUT_PENDING: "bo-badge-yellow",
};

function fmtXAF(v: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(v)) + " XAF";
}

export default function TpeTicketsPage() {
  const { admin } = useAuthAdminStore();
  const canSettle = admin?.role && ["TRADER", "ADMIN", "SUPER_ADMIN"].includes(admin.role);
  const canApprove = admin?.role && ["ADMIN", "SUPER_ADMIN", "FINANCE"].includes(admin.role);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tpes, setTpes] = useState<Tpe[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [tpeId, setTpeId] = useState("");
  const [dangerousOnly, setDangerousOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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

  async function approveTicket(ticketId: string) {
    try {
      const res = await fetch(`${API}/admin/tickets/${ticketId}/approve`, {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      toast.success("Ticket approuvé — payable au guichet");
      await load();
    } catch { toast.error("Erreur réseau"); }
  }

  // Accès exceptionnel (ticket original illisible/perdu, bourrage papier) —
  // affiche le code de validation normalement réservé au ticket imprimé.
  async function revealPayoutCode(ticketId: string) {
    try {
      const res = await fetch(`${API}/admin/tickets/${ticketId}/payout-code`, { headers: authHeaders() });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Erreur"); return; }
      if (!d.data.payoutCode) { toast("Aucun code pour ce ticket (émis avant ce contrôle)", { icon: "ℹ️" }); return; }
      toast.success(`Code de validation : ${d.data.payoutCode}`, { duration: 8000 });
    } catch { toast.error("Erreur réseau"); }
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (tpeId) params.set("tpeId", tpeId);
      if (dangerousOnly) params.set("dangerous", "true");
      if (from) params.set("from", from);
      if (to) params.set("to", to);
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

  useEffect(() => { load(); }, [status, tpeId, dangerousOnly, from, to]);

  // Export Excel — demande explicite du 31/10/2026 : exporte exactement les
  // tickets actuellement affichés (mêmes filtres TPE/statut/période que ceux
  // sélectionnés à l'écran), pas un export à part avec ses propres filtres.
  function exportExcel() {
    if (!tickets.length) { toast.error("Aucun ticket à exporter avec ces filtres"); return; }

    const ticketsSheet = tickets.map((t) => ({
      "Code":           t.code,
      "TPE":            t.tpe?.name ?? t.tpe?.code ?? "—",
      "Caissier":       `${t.cashier?.firstName ?? ""} ${t.cashier?.lastName ?? ""}`.trim(),
      "Statut":         STATUS_LABEL[t.status] ?? t.status,
      "Mise (XAF)":     t.stakeXAF,
      "Cote totale":    Number(t.totalOdds.toFixed(2)),
      "Gain potentiel (XAF)": t.potentialWinXAF,
      "Date":           new Date(t.createdAt).toLocaleString("fr-FR"),
    }));

    const selectionsSheet = tickets.flatMap((t) =>
      (t.items ?? []).map((item) => ({
        "Ticket":   t.code,
        "TPE":      t.tpe?.name ?? t.tpe?.code ?? "—",
        "Match":    `${item.market.event.homeTeam} vs ${item.market.event.awayTeam}`,
        "Marché":   item.market.name,
        "Sélection": item.odd.label,
        "Cote":     Number(item.oddValue.toFixed(2)),
        "Résultat": item.result ? (RESULT_LABEL[item.result] ?? item.result) : "En attente",
        "Coup d'envoi": new Date(item.market.event.startTime).toLocaleString("fr-FR"),
      })),
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ticketsSheet), "Tickets");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(selectionsSheet), "Sélections");

    const range = from || to ? `_${from || "debut"}_a_${to || "aujourdhui"}` : "";
    XLSX.writeFile(wb, `rapport-tpe${range}.xlsx`);
  }

  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function applyPreset(preset: "today" | "7days" | "all") {
    if (preset === "all")   { setFrom(""); setTo(""); return; }
    const today = todayStr();
    setTo(today);
    if (preset === "today") { setFrom(today); return; }
    const d = new Date(); d.setDate(d.getDate() - 6);
    setFrom(d.toISOString().slice(0, 10));
  }

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

  // Regroupement par jour, affiché par défaut (quand pas groupé par TPE) —
  // les tickets restent par ailleurs triés du plus récent au plus ancien
  // (voir l'API), donc l'ordre des groupes suit cet ordre naturellement.
  const groupedByDate = useMemo(() => {
    if (groupByTpe) return null;
    const map = new Map<string, Ticket[]>();
    for (const t of tickets) {
      const key = new Date(t.createdAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()];
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
            {isDangerous(t) && (
              <div className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                <p className="text-xs text-red-300">
                  ⚠️ Gain de {fmtXAF(t.potentialWinXAF)} au-dessus du seuil — approbation requise avant paiement.
                </p>
                {canApprove && (
                  <button className="bo-btn-primary bo-btn-sm shrink-0" onClick={() => approveTicket(t.id)}>
                    Approuver le paiement
                  </button>
                )}
              </div>
            )}

            {canApprove && (t.status === "WON" || t.status === "REFUNDED") && (
              <div className="flex items-center justify-between gap-3 bg-bo-card border border-bo-border rounded-lg px-3 py-2">
                <p className="text-[11px] text-t-faint">
                  🔑 Accès exceptionnel — ticket original illisible, perdu ou bourrage papier
                </p>
                <button className="bo-btn-secondary bo-btn-sm shrink-0" onClick={() => revealPayoutCode(t.id)}>
                  Voir le code de validation
                </button>
              </div>
            )}
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

        <div className="flex items-center gap-1.5">
          <input type="date" className="bo-input w-36" value={from} onChange={(e) => setFrom(e.target.value)} title="Du" />
          <span className="text-t-faint text-xs">→</span>
          <input type="date" className="bo-input w-36" value={to} onChange={(e) => setTo(e.target.value)} title="Au" />
          {(from || to) && (
            <button className="bo-btn-secondary bo-btn-sm" onClick={() => { setFrom(""); setTo(""); }}>✕</button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button className="bo-btn-secondary bo-btn-sm" onClick={() => applyPreset("today")}>Aujourd'hui</button>
          <button className="bo-btn-secondary bo-btn-sm" onClick={() => applyPreset("7days")}>7 jours</button>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-t-muted cursor-pointer">
          <input type="checkbox" checked={dangerousOnly} onChange={(e) => setDangerousOnly(e.target.checked)} />
          ⚠️ Dangereux uniquement
        </label>
        <button className="bo-btn-secondary bo-btn-sm" onClick={exportExcel}>
          ⬇️ Exporter Excel
        </button>
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
        <div className="space-y-3">
          {groupedByDate!.map(([dateLabel, dayTickets]) => (
            <div key={dateLabel} className="bo-card">
              <div className="bo-card-header">
                <span className="bo-card-title capitalize">📅 {dateLabel}</span>
                <span className="text-[11px] text-t-faint">{dayTickets.length} ticket(s)</span>
              </div>
              <div>{dayTickets.map((t) => <TicketRow key={t.id} t={t} />)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
