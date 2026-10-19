"use client";

import { useEffect, useRef, useState } from "react";
import { api, setDeviceSecret } from "@/lib/api";
import { generateDeviceSecret, getStoredDeviceSecret, storeDeviceSecret } from "@/store/device.store";

type DeviceStatus = "CHECKING" | "PENDING_PAIRING" | "ACTIVE" | "BLOCKED" | "DELETED" | "ERROR";

const POLL_MS = 4000;

export function DeviceGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<DeviceStatus>("CHECKING");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [tpeCode, setTpeCode] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let secret = getStoredDeviceSecret();
    if (!secret) {
      secret = generateDeviceSecret();
      storeDeviceSecret(secret);
    }
    setDeviceSecret(secret);
    sync(secret);
    pollRef.current = setInterval(() => sync(secret!), POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // POST /register est idempotent — on le réutilise pour le polling, il renvoie l'état courant du TPE.
  async function sync(secret: string) {
    try {
      const res = await api.post("/tpe-device/register", { deviceSecret: secret });
      const data = res.data.data;
      setStatus(data.status);
      setPairingCode(data.pairingCode ?? null);
      setTpeCode(data.code ?? null);
      if (data.status === "ACTIVE" && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch {
      setStatus("ERROR");
    }
  }

  if (status === "ACTIVE") return <>{children}</>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
        {status === "CHECKING" && (
          <>
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-gray-600">Initialisation de l'appareil…</p>
          </>
        )}

        {status === "PENDING_PAIRING" && (
          <>
            <div className="text-4xl mb-4">🔗</div>
            <h1 className="text-xl font-bold text-gray-900 mb-5">Appairage requis</h1>
            {tpeCode && <p className="text-xs text-gray-400 mb-1">Appareil {tpeCode}</p>}
            <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl py-6 mb-5">
              <p className="font-mono text-4xl font-black tracking-[0.3em] text-slate-800">
                {pairingCode ?? "······"}
              </p>
            </div>
            <p className="text-xs text-gray-400">En attente de validation… cette page se met à jour automatiquement.</p>
          </>
        )}

        {status === "BLOCKED" && (
          <>
            <div className="text-4xl mb-4">🚫</div>
            <h1 className="text-xl font-bold text-red-700 mb-2">TPE bloqué</h1>
            <p className="text-gray-500 text-sm">Ce terminal a été bloqué par le backoffice. Contactez votre administrateur.</p>
          </>
        )}

        {status === "DELETED" && (
          <>
            <div className="text-4xl mb-4">⛔</div>
            <h1 className="text-xl font-bold text-red-700 mb-2">TPE supprimé</h1>
            <p className="text-gray-500 text-sm">Ce terminal n'est plus autorisé. Contactez votre administrateur.</p>
          </>
        )}

        {status === "ERROR" && (
          <>
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Connexion impossible</h1>
            <p className="text-gray-500 text-sm">Vérifiez la connexion internet du terminal. Nouvelle tentative automatique…</p>
          </>
        )}
      </div>
    </div>
  );
}
