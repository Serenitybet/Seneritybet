"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import toast, { Toaster } from "react-hot-toast";
import { api } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";

interface TicketInfo {
  code: string;
  status: "PENDING" | "WON" | "LOST" | "REFUNDED" | "CANCELLED" | "PAID";
  stakeXAF: number;
  totalOdds: number;
  potentialWinXAF: number;
  items: { oddValue: number; result: string | null; market: { name: string; event: { homeTeam: string; awayTeam: string } }; odd: { label: string } }[];
}

interface PaymentReceipt {
  code: string;
  amountPaidXAF: number;
  paidAt: string;
  tpe?: { code: string; name: string | null };
}

const STATUS_LABEL: Record<TicketInfo["status"], string> = {
  PENDING: "⏳ Non encore réglé",
  WON: "✅ Gagnant",
  LOST: "❌ Perdant",
  REFUNDED: "↩️ Remboursé",
  CANCELLED: "🚫 Annulé",
  PAID: "💵 Déjà payé",
};

// Un code ticket ressemble à "ABX-739-KLP" — sert à valider le contenu
// décodé avant de lancer la recherche, pour ignorer tout code non lié à
// un ticket (le ticket est imprimé avec un code-barres CODE128).
const TICKET_CODE_RE = /^[A-Z0-9]{2,6}-[A-Z0-9]{2,6}-[A-Z0-9]{2,6}$/;
// Le code-barres encode le code sans les tirets (3+3+3 caractères, voir
// tpe-ticket) pour rester aussi court/épais que possible — on les
// réinsère ici avant de chercher le ticket.
const RAW_BARCODE_RE = /^[A-Z0-9]{9}$/;
function reinsertDashes(raw: string) {
  return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 9)}`;
}

export default function TpePayoutPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<TicketInfo | null>(null);
  const [paying, setPaying] = useState(false);
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  const [payoutCodeInput, setPayoutCodeInput] = useState("");
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  async function doSearch(rawCode: string) {
    const trimmed = rawCode.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setTicket(null);
    setPaidAmount(null);
    setReceipt(null);
    setPayoutCodeInput("");
    try {
      const res = await api.get(`/tpe/tickets/${trimmed}`);
      setTicket(res.data.data);
      stopCamera(); // le ticket est trouvé (scan ou saisie manuelle) — plus besoin de la caméra
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Code ticket introuvable");
    } finally {
      setLoading(false);
    }
  }

  function scanAnother() {
    setTicket(null);
    setPaidAmount(null);
    setReceipt(null);
    setPayoutCodeInput("");
    setCode("");
    startCamera();
  }

  function searchTicket(e: React.FormEvent) {
    e.preventDefault();
    doSearch(code);
  }

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraActive(false);
  }

  async function startCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Caméra non disponible sur cet appareil — utilisez la saisie manuelle du code.");
      return;
    }
    // Le <video> n'existe dans le DOM que lorsqu'aucun ticket n'est affiché
    // (voir le rendu plus bas) — s'il n'est pas encore monté (ex. juste après
    // avoir cliqué "Scanner un autre ticket"), on réessaie à la frame suivante.
    if (!videoRef.current) {
      requestAnimationFrame(startCamera);
      return;
    }
    try {
      // Les tickets ne sont imprimés qu'en CODE128 (voir tpe-ticket) — limiter
      // le décodeur à ce seul format (au lieu de tous les formats 1D/2D connus
      // par défaut) accélère nettement chaque tentative. On réduit aussi le
      // délai entre deux tentatives (500ms par défaut) pour un scan quasi
      // continu au lieu d'un scan perçu comme lent/saccadé.
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]);
      hints.set(DecodeHintType.TRY_HARDER, false);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 50, delayBetweenScanSuccess: 50 });
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current,
        (result) => {
          if (!result) return;
          const raw = result.getText().trim().toUpperCase();
          const value = TICKET_CODE_RE.test(raw) ? raw
            : RAW_BARCODE_RE.test(raw) ? reinsertDashes(raw)
            : null;
          if (value) {
            stopCamera();
            setCode(value);
            doSearch(value);
          }
        },
      );
      controlsRef.current = controls;
      setCameraActive(true);
    } catch {
      setCameraError("Impossible d'accéder à la caméra — vérifiez les autorisations de l'appareil.");
    }
  }

  useEffect(() => {
    startCamera();
    // Garde-fou : sur certains appareils, la demande d'autorisation caméra
    // ne se résout jamais (ni succès ni erreur) — sans ça l'écran reste
    // bloqué indéfiniment sur "Activation de la caméra…".
    const watchdog = setTimeout(() => {
      setCameraActive((active) => {
        if (!active) {
          setCameraError("La caméra met trop de temps à démarrer. Réessayez ou saisissez le code manuellement.");
        }
        return active;
      });
    }, 7000);
    return () => { stopCamera(); clearTimeout(watchdog); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function payTicket() {
    if (!ticket) return;
    if (!/^\d{4}$/.test(payoutCodeInput)) { toast.error("Entrez le code de validation à 4 chiffres (imprimé sur le ticket original)"); return; }
    const ok = await confirm(`Payer ${ticket.status === "WON" ? ticket.potentialWinXAF.toLocaleString("fr-FR") : ticket.stakeXAF.toLocaleString("fr-FR")} XAF pour le ticket ${ticket.code} ?`);
    if (!ok) return;
    setPaying(true);
    try {
      const res = await api.post(`/tpe/tickets/${ticket.code}/pay`, { payoutCode: payoutCodeInput });
      setPaidAmount(res.data.data.amountPaidXAF);
      setReceipt(res.data.data);
      toast.success("Paiement effectué ✅");
      setTimeout(() => window.print(), 500);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Erreur lors du paiement");
    } finally {
      setPaying(false);
    }
  }

  const canPay = ticket && (ticket.status === "WON" || ticket.status === "REFUNDED");

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Toaster position="top-center" />
      {ConfirmDialog}

      <div className="bg-white rounded-2xl shadow-sm p-6 no-print">
        <h2 className="text-lg font-bold text-gray-800 mb-1">💵 Encaisser un ticket</h2>
        <p className="text-sm text-gray-500 mb-4">
          {ticket ? "Ticket trouvé — vérifiez les détails ci-dessous." : "Visez le code-barres du ticket, ou entrez le code manuellement."}
        </p>

        {!ticket && (
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-4">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {cameraActive && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-4/5 h-16 border-4 border-green-400 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
            )}
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
                {cameraError ? (
                  <>
                    <p className="text-red-300 text-sm font-semibold">{cameraError}</p>
                    <button onClick={startCamera} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold">
                      Réessayer
                    </button>
                  </>
                ) : (
                  <p className="text-gray-300 text-sm">Activation de la caméra…</p>
                )}
              </div>
            )}
          </div>
        )}

        {ticket && (
          <button
            onClick={scanAnother}
            className="w-full mb-4 py-2.5 border-2 border-gray-200 hover:border-green-400 text-gray-600 font-semibold rounded-xl text-sm"
          >
            📷 Scanner un autre ticket
          </button>
        )}

        <form onSubmit={searchTicket} className="flex gap-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex: ABX-739-KLP"
            className="flex-1 px-4 py-3 text-2xl font-mono font-bold tracking-widest border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none uppercase"
          />
          <button type="submit" disabled={loading}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl disabled:opacity-50">
            {loading ? "..." : "Chercher"}
          </button>
        </form>
      </div>

      {ticket && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden no-print">
          <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-xl font-black">{ticket.code}</p>
              <p className="text-slate-300 text-sm">{STATUS_LABEL[ticket.status]}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-300">Cote totale</p>
              <p className="text-3xl font-black">{ticket.totalOdds.toFixed(2)}</p>
            </div>
          </div>

          <div className="p-4 space-y-2">
            {ticket.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {it.market.event.homeTeam} vs {it.market.event.awayTeam}
                  </p>
                  <p className="text-xs text-gray-500">{it.market.name}</p>
                  <span className="inline-block mt-0.5 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded">
                    {it.odd.label}
                  </span>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-black text-green-600 text-lg">{it.oddValue.toFixed(2)}</p>
                  {it.result && <p className="text-xs text-gray-400">{it.result}</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 pb-4">
            <div className="bg-gray-50 border rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Mise :</span>
                <span className="font-bold">{ticket.stakeXAF.toLocaleString("fr-FR")} XAF</span>
              </div>
              <div className="flex justify-between font-black text-lg text-green-700">
                <span>Gain potentiel :</span>
                <span>{ticket.potentialWinXAF.toLocaleString("fr-FR")} XAF</span>
              </div>
            </div>

            {paidAmount !== null ? (
              <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 text-center">
                <p className="text-green-700 font-black text-xl">✅ Payé : {paidAmount.toLocaleString("fr-FR")} XAF</p>
              </div>
            ) : canPay ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Code de validation (imprimé sur le ticket original)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={payoutCodeInput}
                    onChange={(e) => setPayoutCodeInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="0000"
                    className="w-full px-4 py-3 text-2xl font-mono font-bold tracking-[0.5em] text-center border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
                  />
                </div>
                <button onClick={payTicket} disabled={paying}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl disabled:opacity-50 text-lg">
                  {paying ? "Paiement en cours…" : "💵 Payer en espèces"}
                </button>
              </div>
            ) : (
              <p className="text-center text-sm text-gray-400">Rien à payer pour ce ticket.</p>
            )}
          </div>
        </div>
      )}

      {receipt && (
        <div className="print-only">
          <div style={{ fontFamily: "monospace", width: "48mm", padding: "4px 6px", fontSize: 12, lineHeight: 1.4, fontWeight: 900 }}>
            <div style={{ textAlign: "center", borderBottom: "1px solid #000", paddingBottom: 4, marginBottom: 4 }}>
              <p style={{ fontSize: 14, fontWeight: "bold" }}>SERENITYBET</p>
              <p style={{ fontSize: 9 }}>Reçu de paiement</p>
            </div>
            <div style={{ marginBottom: 4 }}>
              <p><strong>Ticket:</strong> {receipt.code}</p>
              <p><strong>TPE:</strong> {receipt.tpe?.name ?? receipt.tpe?.code ?? "—"}</p>
              <p><strong>Payé le:</strong> {new Date(receipt.paidAt).toLocaleString("fr-FR")}</p>
            </div>
            <div style={{ borderTop: "1px dashed #000", paddingTop: 4, textAlign: "center" }}>
              <p style={{ fontSize: 16, fontWeight: "bold" }}>
                {receipt.amountPaidXAF.toLocaleString("fr-FR")} XAF
              </p>
              <p style={{ fontSize: 8, marginTop: 4 }}>Montant versé en espèces</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
