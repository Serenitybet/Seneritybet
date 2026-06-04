"use client";

import { useState } from "react";
import { useBetSlipStore } from "@/store/betslip.store";
import { useAuthStore } from "@/store/auth.store";
import { formatXAF } from "@serenitybet/shared";
import { BetSlip } from "./BetSlip";

export function MobileBetSlipButton() {
  const { selections, totalOdds } = useBetSlipStore();
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);

  if (selections.length === 0) return null;

  return (
    <>
      {/* Bouton flottant coupon */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 md:hidden flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-full shadow-xl shadow-green-900/40 font-bold text-sm active:scale-95 transition-transform"
      >
        <span className="w-5 h-5 bg-white text-green-600 rounded-full text-xs font-black flex items-center justify-center">
          {selections.length}
        </span>
        <span>Mon coupon</span>
        <span className="text-green-200 font-mono">x{totalOdds.toFixed(2)}</span>
      </button>

      {/* Drawer bottom sheet */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-bg-secondary rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border sticky top-0 bg-bg-secondary z-10">
              <span className="font-bold text-txt-primary">Mon coupon ({selections.length})</span>
              <button
                onClick={() => setOpen(false)}
                className="text-txt-muted text-2xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="pb-6">
              <BetSlip />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
