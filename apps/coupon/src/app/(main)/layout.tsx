export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/Header";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { CouponPanel } from "@/components/layout/CouponPanel";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileCouponButton } from "@/components/layout/MobileCouponButton";

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
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
            <CouponPanel />
          </div>
        </aside>
      </div>

      <MobileCouponButton />
      <BottomNav />
    </div>
  );
}
