"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/auth.store";
import { api, setAuthToken } from "@/lib/api";

const IDLE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes — demande explicite des caissières (31/10/2026)
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;

export function IdleLogout() {
  const logout = useAuthStore((s) => s.logout);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        toast.error("Session expirée après 5 min d'inactivité");
        api.post("/auth/logout").catch(() => {}); // révoque côté serveur, au mieux
        logout();
        setAuthToken(null);
      }, IDLE_LIMIT_MS);
    }

    reset();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, reset, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
