import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@serenitybet/shared";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://seneritybet.onrender.com/api";

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, token: string) => void;
  refreshToken: () => Promise<string | null>;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,

      setAuth(user, accessToken) {
        localStorage.setItem("accessToken", accessToken);
        set({ user, accessToken });
      },

      // Rafraîchit le token silencieusement via le cookie httpOnly
      async refreshToken(): Promise<string | null> {
        try {
          const res = await fetch(`${API}/auth/refresh`, {
            method: "POST",
            credentials: "include",
          });
          if (!res.ok) {
            // Refresh échoué → déconnecter
            get().logout();
            return null;
          }
          const data = await res.json();
          const newToken = data.data?.accessToken;
          if (newToken) {
            localStorage.setItem("accessToken", newToken);
            set({ accessToken: newToken });
          }
          return newToken ?? null;
        } catch {
          return null;
        }
      },

      logout() {
        localStorage.removeItem("accessToken");
        set({ user: null, accessToken: null });
        fetch(`${API}/auth/logout`, {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
      },
    }),
    { name: "auth", partialize: (s) => ({ user: s.user, accessToken: s.accessToken }) },
  ),
);
