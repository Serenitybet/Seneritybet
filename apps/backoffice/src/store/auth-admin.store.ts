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
          const token = localStorage.getItem("bo_token");
          if (token) {
            const API = process.env.NEXT_PUBLIC_BACKOFFICE_API_URL ?? "https://seneritybet.onrender.com/api";
            // Révoque la session côté serveur — sans ça, le token reste
            // valable jusqu'à son expiration naturelle malgré la
            // déconnexion. keepalive pour que la requête survive à la
            // navigation immédiate vers /login juste en dessous.
            fetch(`${API}/auth/logout`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              keepalive: true,
            }).catch(() => {});
          }
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
