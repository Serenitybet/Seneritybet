"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
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

const STATUS_LABEL: Record<TicketInfo["status"], string> = {
  PENDING: "⏳ Non encore réglé",
  WON: "✅ Gagnant",
  LOST: "❌ Perdant",
  REFUNDED: "↩️ Remboursé",
  CANCELLED: "🚫 Annulé",
  PAID: "💵 Déjà payé",
};

// Un code ticket ressemble à "ABX-739-KLP" — sert à valider le contenu du QR
// avant de lancer la recherche, pour ignorer tout QR non lié à un ticket.
const TICKET_CODE_RE = /^[A-Z0-9]{2,6}-[A-Z0-9]{2,6}-[A-Z0-9]{2,6}$/;

export default function TpePayoutPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<TicketInfo | null>(null);
  const [paying, setPaying] = useState(false);
  const [paidAmount, setPaidAmount] = useState<number | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  async function doSearch(rawCode: string) {
    const trimmed = rawCode.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setTicket(null);
    setPaidAmount(null);
    try {
      const res = await api.get(`/tpe/tickets/${trimmed}`);
      setTicket(res.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Code ticket introuvable");
    } finally {
      setLoading(false);
    }
  }

  function searchTicket(e: React.FormEvent) {
    e.preventDefault();
    doSearch(code);
  }

  function stopCamera() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      tick();
    } catch {
      setCameraError("Impossible d'accéder à la caméra — vérifiez les autorisations de l'appareil.");
    }
  }

  function tick() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height);
        if (result?.data) {
          const value = result.data.trim().toUpperCase();
          if (TICKET_CODE_RE.test(value)) {
            stopCamera();
            setCode(value);
            doSearch(value);
            return;
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function payTicket() {
    if (!ticket) return;
    const ok = await confirm(`Payer ${ticket.status === "WON" ? ticket.potentialWinXAF.toLocaleString("fr-FR") : ticket.stakeXAF.toLocaleString("fr-FR")} XAF pour le ticket ${ticket.code} ?`);
    if (!ok) return;
    setPaying(true);
    try {
      const res = await api.post(`/tpe/tickets/${ticket.code}/pay`);
      setPaidAmount(res.data.data.amountPaidXAF);
      toast.success("Paiement effectué ✅");
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

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">💵 Encaisser un ticket</h2>
        <p className="text-sm text-gray-500 mb-4">Visez le QR code du ticket, ou entrez le code manuellement.</p>

        <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-4">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          {cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-2/3 aspect-square border-4 border-green-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
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
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
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
              <button onClick={payTicket} disabled={paying}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl disabled:opacity-50 text-lg">
                {paying ? "Paiement en cours…" : "💵 Payer en espèces"}
              </button>
            ) : (
              <p className="text-center text-sm text-gray-400">Rien à payer pour ce ticket.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
