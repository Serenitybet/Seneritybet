"use client";

import { useBetSlipStore } from "@/store/betslip.store";
import { useAuthStore } from "@/store/auth.store";
import { formatXAF } from "@serenitybet/shared";
import toast from "react-hot-toast";
import Link from "next/link";
import { useState } from "react";

export function BetSlip() {
  const { selections, removeSelection, clearSlip, totalOdds } = useBetSlipStore();
  const { user } = useAuthStore();
  const [stake, setStake] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCode, setSavedCode] = useState<string | null>(null);

  const stakeXAF = (parseFloat(stake) || 0) * 100;
  const potentialWin = stakeXAF * totalOdds;

  const QUICK_STAKES = [500, 1000, 2000, 5000];

  async function handleSaveCoupon() {
    if (!user) { toast.error("Connectez-vous d'abord"); return; }
    if (selections.length === 0) { toast.error("Coupon vide"); return; }
    setSaving(true);
    setSavedCode(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/coupons/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({
          selections: selections.map(s => ({
            eventId:     s.eventId,
            marketId:    s.marketId,
            oddId:       s.oddId,
            teamHome:    s.eventLabel?.split(" vs ")?.[0] ?? "",
            teamAway:    s.eventLabel?.split(" vs ")?.[1] ?? "",
            eventName:   s.eventLabel,
            marketName:  s.marketName,
            oddLabel:    s.oddLabel,
            oddValue:    s.oddValue,
          })),
          suggestedStake: stake ? parseFloat(stake) * 100 : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
      setSavedCode(data.data.code);
      toast.success(`✅ Coupon sauvegardé ! Code : ${data.data.code}`, { duration: 8000 });
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  async function handlePlaceBet() {
    if (!user) { toast.error("Connectez-vous pour parier"); return; }
    if (stakeXAF < 100) { toast.error("Mise minimale : 1 XAF"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({
          type: selections.length === 1 ? "SINGLE" : "ACCUMULATOR",
          stake: stakeXAF,
          selections: selections.map((s) => ({
            eventId: s.eventId, marketId: s.marketId,
            oddId: s.oddId, oddValue: s.oddValue,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur lors du pari"); return; }
      toast.success("🎉 Pari enregistré !");
      clearSlip();
      setStake("");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* En-tête coupon */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-bg-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-txt-primary">Coupon</span>
          {selections.length > 0 && (
            <span className="w-5 h-5 bg-green-600 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
              {selections.length}
            </span>
          )}
        </div>
        {selections.length > 0 && (
          <button onClick={clearSlip} className="text-xs text-txt-muted hover:text-live transition-colors">
            Effacer
          </button>
        )}
      </div>

      {selections.length === 0 ? (
        /* Vide */
        <div className="flex flex-col items-center justify-center flex-1 px-4 py-8 text-center">
          <div className="w-16 h-16 bg-bg-card rounded-full flex items-center justify-center mb-3 border border-bg-border">
            <span className="text-2xl">🎯</span>
          </div>
          <p className="text-sm font-medium text-txt-primary mb-1">Votre coupon est vide</p>
          <p className="text-xs text-txt-muted">Cliquez sur une cote pour ajouter une sélection</p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Type de pari */}
          {selections.length > 1 && (
            <div className="px-3 pt-2">
              <div className="flex items-center gap-1 bg-bg-card rounded-lg p-1 border border-bg-border">
                <button className="flex-1 py-1 text-xs font-semibold rounded-md bg-green-600 text-white">
                  Combiné
                </button>
                <button className="flex-1 py-1 text-xs font-medium text-txt-muted hover:text-txt-primary">
                  Système
                </button>
              </div>
            </div>
          )}

          {/* Sélections */}
          <div className="flex-1 overflow-y-auto px-2 pt-2 space-y-1.5">
            {selections.map((sel) => (
              <div key={sel.oddId} className="bg-bg-card border border-bg-border rounded-lg p-2.5">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-txt-primary leading-tight">{sel.eventLabel}</p>
                  <button
                    onClick={() => removeSelection(sel.oddId)}
                    className="text-txt-muted hover:text-live transition-colors shrink-0 w-4 h-4 flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[10px] text-txt-muted mb-1.5">{sel.marketName}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-green-400 bg-green-600/10 px-2 py-0.5 rounded border border-green-600/20">
                    {sel.oddLabel}
                  </span>
                  <span className="text-sm font-black text-gold">{sel.oddValue.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Zone de mise */}
          <div className="border-t border-bg-border p-3 space-y-3">
            {/* Cote totale */}
            {selections.length > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-txt-secondary">Cote combinée</span>
                <span className="font-black text-gold text-base">{totalOdds.toFixed(2)}</span>
              </div>
            )}

            {/* Mise rapide */}
            <div className="grid grid-cols-4 gap-1">
              {QUICK_STAKES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStake(String(s))}
                  className={`py-1 text-[11px] font-semibold rounded border transition-all ${
                    stake === String(s)
                      ? "bg-green-600 border-green-600 text-white"
                      : "bg-bg-input border-bg-border text-txt-secondary hover:border-green-600/50"
                  }`}
                >
                  {s.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Champ mise */}
            <div className="relative">
              <input
                type="number"
                className="field pr-10 font-semibold"
                placeholder="Mise (XAF)"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                min={1}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-txt-muted font-medium">
                XAF
              </span>
            </div>

            {/* Gain potentiel */}
            {stakeXAF > 0 && (
              <div className="bg-green-600/10 border border-green-600/20 rounded-lg p-2.5">
                <div className="flex justify-between text-xs text-txt-secondary mb-1">
                  <span>Mise</span>
                  <span className="font-medium text-txt-primary">{formatXAF(stakeXAF)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-txt-secondary">Gain potentiel</span>
                  <span className="text-green-400 text-base">{formatXAF(potentialWin)}</span>
                </div>
              </div>
            )}

            {/* Code coupon sauvegardé */}
            {savedCode && (
              <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 text-center">
                <p className="text-xs text-txt-muted mb-1">Code coupon (valable 48h)</p>
                <p className="font-mono text-xl font-black text-gold tracking-widest">{savedCode}</p>
                <p className="text-[10px] text-txt-muted mt-1">Présentez ce code en salle de jeux</p>
              </div>
            )}

            {/* Boutons */}
            {user ? (
              <div className="space-y-2">
                <button
                  className="btn-green w-full py-2.5 text-sm"
                  onClick={handlePlaceBet}
                  disabled={loading || stakeXAF < 100}
                >
                  {loading ? "Validation..." : `Parier en ligne${stakeXAF > 0 ? ` — ${formatXAF(stakeXAF)}` : ""}`}
                </button>
                <button
                  className="w-full py-2 text-sm font-semibold border border-gold/40 text-gold bg-gold/5 hover:bg-gold/10 rounded-lg transition-colors"
                  onClick={handleSaveCoupon}
                  disabled={saving || selections.length === 0}
                >
                  {saving ? "Sauvegarde..." : "🎫 Jouer en salle de jeux (code)"}
                </button>
              </div>
            ) : (
              <Link href="/login" className="btn-green w-full py-2.5 text-sm text-center block">
                Se connecter pour parier
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
