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
        <main className="flex-1 p-6 overflow-y-auto relative">
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
