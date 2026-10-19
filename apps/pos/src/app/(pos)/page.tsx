"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setAuthToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

interface DeviceInfo {
  code: string;
  name: string | null;
  status: string;
  creditXAF: number;
  lastSeenAt: string | null;
  pairedAt: string | null;
}

function Tile({
  href, icon, label, primary, onClick,
}: { href?: string; icon: ReactNode; label: string; primary?: boolean; onClick?: () => void }) {
  const content = (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-5 h-28 text-center transition-colors active:scale-[0.98] ${
        primary
          ? "bg-gradient-to-br from-green-500 to-green-600 text-slate-950 shadow-lg shadow-green-900/40"
          : "bg-slate-800/70 border border-slate-700 text-slate-100 hover:border-green-500/40"
      }`}
    >
      <span className="text-3xl leading-none">{icon}</span>
      <span className="font-bold text-sm leading-tight">{label}</span>
    </div>
  );
  if (onClick) return <button onClick={onClick} className="contents">{content}</button>;
  return <Link href={href!} className="contents">{content}</Link>;
}

function QrIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
      <path d="M3 3h7v7H3V3zm2 2v3h3V5H5zM3 14h7v7H3v-7zm2 2v3h3v-3H5zM14 3h7v7h-7V3zm2 2v3h3V5h-3zM14 14h2v2h-2v-2zM18 14h3v2h-3v-2zM14 18h2v3h-2v-3zM18 17h3v4h-3v-4z" />
    </svg>
  );
}

export default function PosHomePage() {
  const router = useRouter();
  const { token, cashier, logout } = useAuthStore();
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [hideCredit, setHideCredit] = useState(false);
  const [showDeviceInfo, setShowDeviceInfo] = useState(false);

  useEffect(() => {
    if (token) setAuthToken(token);
    api.get("/tpe-device/status").then((r) => setDevice(r.data.data)).catch(() => {});
  }, [token]);

  function handleLogout() {
    logout();
    setAuthToken(null);
    router.replace("/login");
  }

  return (
    <div className="min-h-[calc(100vh-61px)] bg-gradient-to-b from-slate-950 to-slate-900 text-white px-4 py-6 sm:px-6">
      <div className="max-w-md mx-auto space-y-5">
        {/* Greeting */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-widest">Bienvenue</p>
            <h1 className="text-xl font-black text-green-400">{cashier?.firstName} {cashier?.lastName}</h1>
          </div>
          <button
            onClick={() => setHideCredit(!hideCredit)}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
          >
            {hideCredit ? "👁 Afficher" : "🙈 Masquer"}
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-4">
            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-1">TPE</p>
            <p className="font-mono font-black text-lg text-white">{device?.code ?? "—"}</p>
          </div>
          <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-4">
            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-1">Crédit disponible</p>
            <p className="font-black text-lg text-green-400">
              {hideCredit ? "•••••" : device ? `${device.creditXAF.toLocaleString("fr-FR")} XAF` : "…"}
            </p>
          </div>
        </div>

        {/* Actions principales */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Tile href="/tpe-payout" icon={<QrIcon />} label="Scanner un ticket" primary />
          </div>
          <Tile href="/tpe-ticket" icon="🆕" label="Nouveau ticket" />
          <Tile href="/tpe-history" icon="🧾" label="Historique de paris" />
          <Tile href="/caisse" icon="💰" label="Caisse (dépôt/retrait)" />
          <Tile icon="🚪" label="Déconnexion" onClick={handleLogout} />
        </div>

        {/* Infos de l'appareil */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowDeviceInfo(!showDeviceInfo)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-200"
          >
            <span>ℹ️ Informations de l'appareil</span>
            <span className={`transition-transform ${showDeviceInfo ? "rotate-90" : ""}`}>→</span>
          </button>
          {showDeviceInfo && device && (
            <div className="px-4 pb-4 space-y-1.5 text-xs text-slate-400 border-t border-slate-700 pt-3">
              <p>Nom : <span className="text-slate-200">{device.name ?? "—"}</span></p>
              <p>Statut : <span className="text-green-400">{device.status}</span></p>
              <p>Appairé le : <span className="text-slate-200">{device.pairedAt ? new Date(device.pairedAt).toLocaleString("fr-FR") : "—"}</span></p>
              <p>Dernière activité : <span className="text-slate-200">{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString("fr-FR") : "—"}</span></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
