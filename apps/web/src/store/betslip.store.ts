import { create } from "zustand";
import { persist } from "zustand/middleware";

interface BetSelection {
  eventId: string;
  eventLabel: string;
  marketId: string;
  marketName: string;
  oddId: string;
  oddLabel: string;
  oddValue: number;
}

interface BetSlipStore {
  selections: BetSelection[];
  totalOdds: number;
  addSelection: (sel: BetSelection) => void;
  removeSelection: (oddId: string) => void;
  hasSelection: (oddId: string) => boolean;
  clearSlip: () => void;
}

function calcTotalOdds(selections: BetSelection[]): number {
  if (selections.length === 0) return 1;
  return selections.reduce((acc, s) => acc * s.oddValue, 1);
}

export const useBetSlipStore = create<BetSlipStore>()(
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
    { name: "betslip" },
  ),
);
