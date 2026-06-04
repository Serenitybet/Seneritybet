import { create } from "zustand";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://seneritybet.onrender.com/api";

interface WalletStore {
  balance: number;
  bonusBalance: number;
  setBalance: (balance: number, bonusBalance?: number) => void;
  fetchBalance: () => Promise<void>;
}

// Rafraîchit le token JWT silencieusement via le refresh token (cookie httpOnly)
async function silentRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      credentials: "include", // envoie le cookie refreshToken
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newToken = data.data?.accessToken;
    if (newToken) {
      localStorage.setItem("accessToken", newToken);
      return newToken;
    }
    return null;
  } catch {
    return null;
  }
}

export const useWalletStore = create<WalletStore>()((set) => ({
  balance: 0,
  bonusBalance: 0,

  setBalance(balance, bonusBalance = 0) {
    set({ balance, bonusBalance });
  },

  async fetchBalance() {
    let token = localStorage.getItem("accessToken");
    if (!token) return;

    try {
      let res = await fetch(`${API}/wallet`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      // Si token expiré (401) → on essaie de le rafraîchir automatiquement
      if (res.status === 401) {
        const newToken = await silentRefresh();
        if (!newToken) return; // Impossible de rafraîchir → l'utilisateur doit se reconnecter
        res = await fetch(`${API}/wallet`, {
          headers: { Authorization: `Bearer ${newToken}` },
          credentials: "include",
        });
      }

      if (res.ok) {
        const data = await res.json();
        set({ balance: data.data.balance, bonusBalance: data.data.bonusBalance });
      }
    } catch { /* ignore les erreurs réseau */ }
  },
}));
