import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Serenitybet — Coupons en ligne",
  description: "Composez votre coupon de paris sportifs en ligne, sans compte, et retirez-le en espèces dans une boutique Serenitybet au Tchad.",
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
