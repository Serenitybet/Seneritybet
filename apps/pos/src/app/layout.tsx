import type { Metadata } from "next";
import "./globals.css";
import { DeviceGate } from "@/components/DeviceGate";

export const metadata: Metadata = {
  title: "Serenitybet — Caisse",
  description: "Application caisse pour agents Serenitybet",
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
