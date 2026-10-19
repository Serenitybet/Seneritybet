"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const COUPON_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "En attente de retrait en boutique", color: "text-gold" },
  EXPIRED:   { label: "Expiré",                              color: "text-live" },
  CANCELLED: { label: "Annulé",                              color: "text-live" },
};

const TICKET_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "En attente du résultat", color: "text-gold" },
  WON:       { label: "Gagné — à retirer en boutique", color: "text-green-400" },
  LOST:      { label: "Perdu", color: "text-live" },
  REFUNDED:  { label: "Remboursé", color: "text-info" },
  CANCELLED: { label: "Annulé", color: "text-live" },
  PAID:      { label: "Payé", color: "text-txt-muted" },
};

const ITEM_RESULT_LABEL: Record<string, { label: string; color: string }> = {
  WON:  { label: "Gagné", color: "text-green-400" },
  LOST: { label: "Perdu", color: "text-live" },
  VOID: { label: "Annulé", color: "text-txt-muted" },
};

interface Selection {
  eventId: string;
  eventLabel: string;
  marketId: string;
  marketName: string;
  oddId: string;
  oddLabel: string;
  oddValue: number;
}

interface TicketItem {
  id: string;
  oddValue: number;
  result: string | null;
  market: { name: string; event: { homeTeam: string; awayTeam: string } };
  odd: { label: string };
}

interface Ticket {
  id: string;
  code: string;
  status: string;
  stakeXAF: number;
  totalOdds: number;
  potentialWinXAF: number;
  createdAt: string;
  paidAt: string | null;
  items: TicketItem[];
}

type Result =
  | { code: string; status: "PENDING" | "EXPIRED" | "CANCELLED"; selections: Selection[]; expiresAt: string }
  | { code: string; status: "USED"; ticket: Ticket };

export default function VerifierPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function doSearch(c: string) {
    const clean = c.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/web-coupons/${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Code introuvable"); return; }
      setResult(data.data);
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initial = searchParams.get("code");
    if (initial) doSearch(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.replace(`/verifier?code=${encodeURIComponent(code.trim().toUpperCase())}`);
    doSearch(code);
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-black text-txt-primary mb-1">Vérifier un coupon ou un ticket</h1>
        <p className="text-sm text-txt-muted">
          Entrez le code reçu lors de l'enregistrement de votre coupon, ou le code imprimé sur votre ticket.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="field font-mono uppercase tracking-widest text-center"
          placeholder="XXX-XXX-XXX"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={20}
        />
        <button type="submit" className="btn-green px-5 shrink-0" disabled={loading || !code.trim()}>
          {loading ? "..." : "Vérifier"}
        </button>
      </form>

      {error && (
        <div className="bg-live/10 border border-live/30 rounded-xl p-4 text-center text-sm text-live">
          {error}
        </div>
      )}

      {result && result.status === "USED" && (
        <TicketResultView ticket={result.ticket} />
      )}

      {result && result.status !== "USED" && (
        <CouponResultView
          code={result.code}
          status={result.status}
          selections={"selections" in result ? result.selections : []}
          expiresAt={"expiresAt" in result ? result.expiresAt : null}
        />
      )}
    </div>
  );
}

function CouponResultView({
  code, status, selections, expiresAt,
}: { code: string; status: string; selections: Selection[]; expiresAt: string | null }) {
  const info = COUPON_STATUS_LABEL[status] ?? { label: status, color: "text-txt-primary" };
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-lg font-black text-txt-primary tracking-widest">{code}</span>
        <span className={`text-sm font-bold ${info.color}`}>{info.label}</span>
      </div>
      {expiresAt && (
        <p className="text-xs text-txt-muted">
          Valable jusqu'au {new Date(expiresAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
        </p>
      )}
      <div className="divide-y divide-bg-border">
        {selections.map((s) => (
          <div key={s.oddId} className="py-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-txt-primary truncate">{s.eventLabel}</p>
              <p className="text-[11px] text-txt-muted">{s.marketName} · {s.oddLabel}</p>
            </div>
            <span className="text-sm font-black text-gold shrink-0">{s.oddValue.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TicketResultView({ ticket }: { ticket: Ticket }) {
  const info = TICKET_STATUS_LABEL[ticket.status] ?? { label: ticket.status, color: "text-txt-primary" };
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-lg font-black text-txt-primary tracking-widest">{ticket.code}</span>
        <span className={`text-sm font-bold ${info.color}`}>{info.label}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-txt-muted">
        <span>Cote totale <span className="text-gold font-bold">{ticket.totalOdds.toFixed(2)}</span></span>
        <span>Gain potentiel <span className="text-green-400 font-bold">{ticket.potentialWinXAF.toLocaleString()} XAF</span></span>
      </div>
      <div className="divide-y divide-bg-border">
        {ticket.items.map((item) => {
          const resInfo = item.result ? ITEM_RESULT_LABEL[item.result] : null;
          return (
            <div key={item.id} className="py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-txt-primary truncate">
                  {item.market.event.homeTeam} — {item.market.event.awayTeam}
                </p>
                <p className="text-[11px] text-txt-muted">{item.market.name} · {item.odd.label}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-black text-gold">{Number(item.oddValue).toFixed(2)}</span>
                {resInfo && <span className={`text-[11px] font-bold ${resInfo.color}`}>{resInfo.label}</span>}
              </div>
            </div>
          );
        })}
      </div>
      {ticket.status === "WON" && (
        <p className="text-xs text-green-400 text-center bg-green-600/10 border border-green-600/20 rounded-lg p-2">
          Présentez ce ticket (ou son code) en boutique pour être payé.
        </p>
      )}
    </div>
  );
}
