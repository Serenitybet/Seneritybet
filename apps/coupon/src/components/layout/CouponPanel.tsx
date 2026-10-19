"use client";

import { useCouponStore } from "@/store/coupon.store";
import toast from "react-hot-toast";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export function CouponPanel() {
  const { selections, removeSelection, clearSlip, totalOdds } = useCouponStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ code: string; expiresAt: string } | null>(null);

  async function handleSaveCoupon() {
    if (selections.length === 0) { toast.error("Coupon vide"); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/web-coupons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selections: selections.map((s) => ({ oddId: s.oddId })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
      setSaved({ code: data.data.code, expiresAt: data.data.expiresAt });
      clearSlip();
      toast.success("Coupon enregistré !");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  function handleNewCoupon() {
    setSaved(null);
  }

  if (saved) {
    const expiry = new Date(saved.expiresAt);
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-3 border-b border-bg-border">
          <span className="text-sm font-bold text-txt-primary">Coupon enregistré</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 text-center">
          <div className="w-16 h-16 bg-green-600/10 border border-green-600/30 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">🎫</span>
          </div>
          <p className="text-xs text-txt-muted mb-1">Votre code coupon</p>
          <p className="font-mono text-3xl font-black text-gold tracking-widest mb-3">{saved.code}</p>
          <div className="bg-bg-card border border-bg-border rounded-lg p-3 text-xs text-txt-secondary space-y-1 mb-4">
            <p>📍 Présentez ce code dans une boutique Serenitybet</p>
            <p>💵 Le caissier saisira votre mise en espèces</p>
            <p>⏰ Valable jusqu'au {expiry.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</p>
          </div>
          <button onClick={handleNewCoupon} className="btn-outline w-full py-2 text-sm">
            Composer un nouveau coupon
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
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
        <div className="flex flex-col items-center justify-center flex-1 px-4 py-8 text-center">
          <div className="w-16 h-16 bg-bg-card rounded-full flex items-center justify-center mb-3 border border-bg-border">
            <span className="text-2xl">🎯</span>
          </div>
          <p className="text-sm font-medium text-txt-primary mb-1">Votre coupon est vide</p>
          <p className="text-xs text-txt-muted">Cliquez sur une cote pour ajouter une sélection</p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
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

          <div className="border-t border-bg-border p-3 space-y-3">
            {selections.length > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-txt-secondary">Cote combinée</span>
                <span className="font-black text-gold text-base">{totalOdds.toFixed(2)}</span>
              </div>
            )}

            <p className="text-[11px] text-txt-muted text-center">
              Aucune mise à saisir ici — elle sera décidée et payée en espèces en boutique.
            </p>

            <button
              className="btn-green w-full py-2.5 text-sm"
              onClick={handleSaveCoupon}
              disabled={saving || selections.length === 0}
            >
              {saving ? "Enregistrement..." : "Enregistrer mon coupon"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
