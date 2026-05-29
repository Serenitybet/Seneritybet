export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/Header";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { BetSlip } from "@/components/layout/BetSlip";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-bg-primary">
      <Header />
      <div className="flex flex-1 w-full max-w-[1600px] mx-auto">
        {/* Sidebar gauche — sports */}
        <aside className="hidden lg:flex flex-col w-52 xl:w-56 shrink-0 border-r border-bg-border">
          <LeftSidebar />
        </aside>

        {/* Contenu principal */}
        <main className="flex-1 min-w-0 p-3 lg:p-4">
          {children}
        </main>

        {/* Coupon de paris */}
        <aside className="hidden xl:flex flex-col w-72 shrink-0 border-l border-bg-border">
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
            <BetSlip />
          </div>
        </aside>
      </div>
    </div>
  );
}
