import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DeviceGate } from "@/components/DeviceGate";

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
        <DeviceGate>{children}</DeviceGate>
      </body>
    </html>
  );
}
