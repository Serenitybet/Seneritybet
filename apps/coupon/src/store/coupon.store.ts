import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CouponSelection {
  eventId: string;
  eventLabel: string;
  marketId: string;
  marketName: string;
  oddId: string;
  oddLabel: string;
  oddValue: number;
}

interface CouponStore {
  selections: CouponSelection[];
  totalOdds: number;
  addSelection: (sel: CouponSelection) => void;
  removeSelection: (oddId: string) => void;
  hasSelection: (oddId: string) => boolean;
  clearSlip: () => void;
}

function calcTotalOdds(selections: CouponSelection[]): number {
  if (selections.length === 0) return 1;
  return selections.reduce((acc, s) => acc * s.oddValue, 1);
}

// Coupon composé sans compte — purement local jusqu'à l'enregistrement
// (POST /api/web-coupons) qui renvoie le code à présenter en boutique.
export const useCouponStore = create<CouponStore>()(
  persist(
    (set, get) => ({
      selections: [],
      totalOdds: 1,

      addSelection(sel) {
        // Un seul pari par événement
        const filtered = get().selections.filter((s) => s.eventId !== sel.eventId);
        const next = [...filtered, sel];
        set({ selections: next, totalOdds: calcTotalOdds(next) });
      },

      removeSelection(oddId) {
        const next = get().selections.filter((s) => s.oddId !== oddId);
        set({ selections: next, totalOdds: calcTotalOdds(next) });
      },

      hasSelection(oddId) {
        return get().selections.some((s) => s.oddId === oddId);
      },

      clearSlip() {
        set({ selections: [], totalOdds: 1 });
      },
    }),
    { name: "web-coupon-slip" },
  ),
);
