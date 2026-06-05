import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const dynamic = "force-dynamic";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Serenitybet Partners — Programme d'affiliation",
  description: "Devenez partenaire Serenitybet et gagnez des commissions sur vos filleuls.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen`}>
        {children}
        <Toaster position="top-right" toastOptions={{
          style: { background: "#1f2937", color: "#f9fafb", border: "1px solid #374151" },
          success: { iconTheme: { primary: "#10b981", secondary: "#f9fafb" } },
        }} />
      </body>
    </html>
  );
}
