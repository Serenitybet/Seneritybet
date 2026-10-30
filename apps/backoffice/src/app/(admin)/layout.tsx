export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { IdleLogout } from "@/components/IdleLogout";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bo-base">
      <IdleLogout />
      <Sidebar />
      <div className="flex-1 flex flex-col ml-56 min-h-screen">
        <Topbar />
        {/* Pas de overflow-y-auto ici : <main> n'a pas de hauteur bornée, il
            grandit avec son contenu — c'est donc la fenêtre qui défile
            réellement, pas <main>. Garder overflow-y-auto ici cassait les
            enfants "sticky" (ex. panneau Marchés) : ils se calaient sur le
            défilement de <main> (toujours à 0) au lieu de celui de la
            fenêtre, et semblaient figés hors champ (signalé en prod le
            30/10/2026). La sidebar reste fixe via sa propre position
            "fixed", donc ce retrait ne change rien à son comportement. */}
        <main className="flex-1 p-6 relative">
          <div
            aria-hidden
            className="pointer-events-none select-none fixed inset-y-0 left-56 right-0 flex items-center justify-center overflow-hidden z-0"
          >
            <span className="text-[42vw] font-black text-t-primary/[0.035] leading-none">S</span>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
