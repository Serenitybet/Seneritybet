import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface AuthAdminState {
  admin: AdminUser | null;
  token: string | null;
  setAdmin: (admin: AdminUser, token: string) => void;
  logout: () => void;
  getToken: () => string | null;
}

// Persisté (pas seulement le token dans localStorage à part) : sans ça,
// `admin` (et donc son rôle, utilisé pour les droits comme le règlement
// des tickets TPE) repart à null à chaque rechargement de page, alors que
// le token reste valide — l'utilisateur reste connecté mais perd ses droits.
export const useAuthAdminStore = create<AuthAdminState>()(
  persist(
    (set, get) => ({
      admin: null,
      token: null,

      setAdmin: (admin, token) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("bo_token", token);
        }
        set({ admin, token });
      },

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("bo_token");
          window.location.href = "/login";
        }
        set({ admin: null, token: null });
      },

      getToken: () => {
        if (typeof window !== "undefined") {
          return localStorage.getItem("bo_token");
        }
        return get().token;
      },
    }),
    { name: "bo-auth", partialize: (s) => ({ admin: s.admin, token: s.token }) },
  ),
);
