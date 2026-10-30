import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = "https://serenitybetcode.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Serenitybet — Paris sportifs en ligne au Tchad",
    template: "%s — Serenitybet",
  },
  description: "Composez votre coupon de paris sportifs en ligne sur Serenitybet, sans compte, et retirez-le en espèces dans une boutique Serenitybet au Tchad.",
  // Rend le site installable comme application (Android/Chrome propose
  // automatiquement un bandeau d'installation ; voir InstallPrompt.tsx pour
  // la bannière personnalisée + le repli manuel iOS Safari).
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Serenitybet",
  },
  // Signale explicitement à Google/Bing d'indexer le site — n'empêche pas une
  // absence d'indexation en soi (ça demande surtout une soumission dans
  // Google Search Console + un peu de temps pour un domaine tout neuf), mais
  // enlève un doute possible côté code.
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "Serenitybet — Paris sportifs en ligne au Tchad",
    description: "Composez votre coupon de paris sportifs en ligne, sans compte, et retirez-le en espèces dans une boutique Serenitybet au Tchad.",
    url: SITE_URL,
    siteName: "Serenitybet",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Serenitybet — Paris sportifs en ligne au Tchad",
    description: "Composez votre coupon de paris sportifs en ligne, sans compte, et retirez-le en espèces dans une boutique Serenitybet au Tchad.",
  },
};

// Pas de maximumScale/userScalable verrouillés ici (contrairement à
// apps/pos, un outil interne) — site public, le zoom doit rester possible
// pour l'accessibilité.
export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-bg-primary text-txt-primary min-h-screen`}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
