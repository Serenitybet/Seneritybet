import { create } from "zustand";

interface WalletStore {
  balance: number;
  bonusBalance: number;
  setBalance: (balance: number, bonusBalance?: number) => void;
  fetchBalance: () => Promise<void>;
}

export const useWalletStore = create<WalletStore>()((set) => ({
  balance: 0,
  bonusBalance: 0,

  setBalance(balance, bonusBalance = 0) {
    set({ balance, bonusBalance });
  },

  async fetchBalance() {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/wallet`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        set({ balance: data.data.balance, bonusBalance: data.data.bonusBalance });
      }
    } catch {}
  },
}));
