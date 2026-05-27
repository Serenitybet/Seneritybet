import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CashierInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface AuthState {
  token: string | null;
  cashier: CashierInfo | null;
  setAuth: (token: string, cashier: CashierInfo) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      cashier: null,
      setAuth: (token, cashier) => set({ token, cashier }),
      logout: () => set({ token: null, cashier: null }),
    }),
    { name: "pos-auth" }
  )
);
