import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@serenitybet/shared";

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,

      setAuth(user, accessToken) {
        localStorage.setItem("accessToken", accessToken);
        set({ user, accessToken });
      },

      logout() {
        localStorage.removeItem("accessToken");
        set({ user: null, accessToken: null });
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
      },
    }),
    { name: "auth", partialize: (s) => ({ user: s.user, accessToken: s.accessToken }) },
  ),
);
