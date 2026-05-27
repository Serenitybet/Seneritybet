import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Serenitybet — Caisse",
  description: "Application caisse pour agents Serenitybet",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
