import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DeviceGate } from "@/components/DeviceGate";
import { SwAutoReload } from "@/components/SwAutoReload";
import { InstallPrompt } from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: "Serenitybet — Caisse",
  description: "Application caisse pour agents Serenitybet",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Serenitybet TPE",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <SwAutoReload />
        {/* Hors de DeviceGate : doit pouvoir proposer l'installation même
            avant l'appairage, sur un appareil tout juste déballé. */}
        <InstallPrompt />
        <DeviceGate>{children}</DeviceGate>
      </body>
    </html>
  );
}
