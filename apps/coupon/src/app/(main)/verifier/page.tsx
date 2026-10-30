"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const COUPON_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "Disponible en boutique", color: "text-green-700" },
  EXPIRED:   { label: "Expiré",                 color: "text-live" },
  CANCELLED: { label: "Annulé",                 color: "text-live" },
};

const TICKET_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:            { label: "En attente du résultat", color: "text-info" },
  WON:                { label: "Gagné — à retirer en boutique", color: "text-green-700" },
  LOST:               { label: "Perdu", color: "text-live" },
  REFUNDED:           { label: "Remboursé", color: "text-info" },
  CANCELLED:          { label: "Annulé", color: "text-live" },
  PAID:               { label: "Payé", color: "text-txt-muted" },
  CASHED_OUT_PENDING: { label: "Cash-out accepté — à retirer en boutique", color: "text-green-700" },
};

const ITEM_RESULT_LABEL: Record<string, { label: string; color: string }> = {
  WON:  { label: "Gagné", color: "text-green-700" },
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

interface CashoutQuote {
  eligible: boolean;
  reason?: string;
  fairValueXAF?: number;
  offerXAF?: number;
  marginPct?: number;
}

interface Ticket {
  id: string;
  code: string;
  status: string;
  stakeXAF: number;
  totalOdds: number;
  potentialWinXAF: number;
  cashedOutAmountXAF: number | null;
  createdAt: string;
  paidAt: string | null;
  items: TicketItem[];
  cashoutQuote?: CashoutQuote | null;
}

type Result =
  // Coupon web — réutilisable jusqu'à expiration : tickets liste tous les
  // retraits déjà effectués à partir de ce code (peut être vide, un, ou
  // plusieurs si le parieur l'a partagé avec des amis).
  | { code: string; status: "PENDING" | "EXPIRED" | "CANCELLED"; selections: Selection[]; expiresAt: string; tickets: Ticket[] }
  // Code de ticket saisi directement (pas un coupon web)
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
          placeholder="1234"
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

      {result && "ticket" in result && (
        <TicketResultView ticket={result.ticket} onCashedOut={() => doSearch(code)} />
      )}

      {result && "selections" in result && (
        <>
          <CouponResultView
            code={result.code}
            status={result.status}
            selections={result.selections}
            expiresAt={result.expiresAt}
          />
          {result.tickets.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-txt-muted uppercase tracking-wide">
                {result.tickets.length > 1
                  ? `${result.tickets.length} tickets déjà retirés avec ce code`
                  : "1 ticket déjà retiré avec ce code"}
              </p>
              {result.tickets.map((t) => <TicketResultView key={t.id} ticket={t} onCashedOut={() => doSearch(code)} />)}
            </div>
          )}
        </>
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
            <span className="text-sm font-black text-txt-primary shrink-0">{s.oddValue.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TicketResultView({ ticket, onCashedOut }: { ticket: Ticket; onCashedOut: () => void }) {
  const info = TICKET_STATUS_LABEL[ticket.status] ?? { label: ticket.status, color: "text-txt-primary" };
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-lg font-black text-txt-primary tracking-widest">{ticket.code}</span>
        <span className={`text-sm font-bold ${info.color}`}>{info.label}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-txt-muted">
        <span>Cote totale <span className="text-green-700 font-bold">{ticket.totalOdds.toFixed(2)}</span></span>
        <span>Gain potentiel <span className="text-green-700 font-bold">{ticket.potentialWinXAF.toLocaleString()} XAF</span></span>
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
                <span className="text-sm font-black text-txt-primary">{Number(item.oddValue).toFixed(2)}</span>
                {resInfo && <span className={`text-[11px] font-bold ${resInfo.color}`}>{resInfo.label}</span>}
              </div>
            </div>
          );
        })}
      </div>
      {ticket.status === "WON" && (
        <p className="text-xs text-green-700 text-center bg-green-600/10 border border-green-600/20 rounded-lg p-2">
          Présentez ce ticket (ou son code) en boutique pour être payé.
        </p>
      )}
      {ticket.status === "CASHED_OUT_PENDING" && (
        <p className="text-xs text-green-700 text-center bg-green-600/10 border border-green-600/20 rounded-lg p-2">
          Cash-out de {ticket.cashedOutAmountXAF?.toLocaleString()} XAF accepté — présentez ce ticket (ou son code) en
          boutique pour être payé.
        </p>
      )}
      {ticket.status === "PENDING" && ticket.cashoutQuote?.eligible && (
        <CashoutOffer ticket={ticket} quote={ticket.cashoutQuote} onCashedOut={onCashedOut} />
      )}
    </div>
  );
}

function CashoutOffer({ ticket, quote, onCashedOut }: { ticket: Ticket; quote: CashoutQuote; onCashedOut: () => void }) {
  const [open, setOpen] = useState(false);
  const [payoutCode, setPayoutCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    if (payoutCode.trim().length !== 4) { setError("Entrez le code à 4 chiffres imprimé sur votre ticket"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/web-coupons/${encodeURIComponent(ticket.code)}/cashout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutCode: payoutCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erreur"); return; }
      onCashedOut();
    } catch {
      setError("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="bg-green-600/10 border border-green-600/20 rounded-lg p-3 space-y-2 text-center">
        <p className="text-xs text-txt-muted font-bold">
          Cash-out
        </p>
        <p className="text-2xl font-black text-green-700">{quote.offerXAF?.toLocaleString()} XAF</p>
        <button onClick={() => setOpen(true)} className="btn-green w-full py-2 text-sm">
          💸 Encaisser maintenant
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={accept} className="bg-green-600/10 border border-green-600/20 rounded-lg p-3 space-y-2.5">
      <p className="text-xs text-txt-muted text-center">
        En confirmant, vous acceptez <strong className="text-txt-primary">{quote.offerXAF?.toLocaleString()} XAF</strong>{" "}
        à la place du gain potentiel ({ticket.potentialWinXAF.toLocaleString()} XAF) — définitif, non annulable.
      </p>
      <input
        className="field font-mono text-center tracking-widest"
        placeholder="Code à 4 chiffres (sur votre ticket)"
        maxLength={4}
        inputMode="numeric"
        value={payoutCode}
        onChange={(e) => setPayoutCode(e.target.value.replace(/\D/g, ""))}
      />
      {error && <p className="text-xs text-live text-center">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-outline flex-1 py-2 text-sm">
          Annuler
        </button>
        <button type="submit" disabled={submitting} className="btn-green flex-1 py-2 text-sm">
          {submitting ? "..." : "Confirmer"}
        </button>
      </div>
    </form>
  );
}
