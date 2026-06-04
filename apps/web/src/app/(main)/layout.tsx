export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/Header";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { BetSlip } from "@/components/layout/BetSlip";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileBetSlipButton } from "@/components/layout/MobileBetSlipButton";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-bg-primary">
      <Header />
      <div className="flex flex-1 w-full max-w-[1600px] mx-auto">
        {/* Sidebar gauche — sports (desktop uniquement) */}
        <aside className="hidden lg:flex flex-col w-52 xl:w-56 shrink-0 border-r border-bg-border">
          <LeftSidebar />
        </aside>

        {/* Contenu principal — padding bottom pour la bottom nav mobile */}
        <main className="flex-1 min-w-0 p-3 lg:p-4 pb-24 md:pb-4">
          {children}
        </main>

        {/* Coupon de paris (desktop uniquement) */}
        <aside className="hidden xl:flex flex-col w-72 shrink-0 border-l border-bg-border">
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
            <BetSlip />
          </div>
        </aside>
      </div>

      {/* Mobile uniquement */}
      <MobileBetSlipButton />
      <BottomNav />
    </div>
  );
}
