import { create } from "zustand";

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

export const useAuthAdminStore = create<AuthAdminState>((set, get) => ({
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
}));
