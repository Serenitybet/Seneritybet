export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/Header";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { CouponPanel } from "@/components/layout/CouponPanel";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileCouponButton } from "@/components/layout/MobileCouponButton";
import { InstallPrompt } from "@/components/layout/InstallPrompt";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-bg-primary">
      <Header />
      <div className="flex flex-1 w-full max-w-[1600px] mx-auto">
        <aside className="hidden lg:flex flex-col w-52 xl:w-56 shrink-0 border-r border-bg-border">
          <LeftSidebar />
        </aside>

        <main className="flex-1 min-w-0 p-3 lg:p-4 pb-24 md:pb-4">
          {children}
        </main>

        <aside className="hidden xl:flex flex-col w-72 shrink-0 border-l border-bg-border">
          {/* Pas de overflow-y-auto ici : CouponPanel gère déjà son propre
              défilement interne (liste des sélections uniquement), pour que
              le pied (cote combinée + bouton "Enregistrer") reste toujours
              visible au lieu de nécessiter un défilement de tout le panneau. */}
          <div className="sticky top-16 h-[calc(100vh-4rem)]">
            <CouponPanel />
          </div>
        </aside>
      </div>

      <InstallPrompt />
      <MobileCouponButton />
      <BottomNav />
    </div>
  );
}
