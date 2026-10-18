import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Serenitybet — Backoffice",
  robots: "noindex, nofollow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-bo-base text-t-primary min-h-screen font-sans">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#ffffff",
              color: "#16181b",
              border: "1px solid #e3e6ea",
              borderRadius: "8px",
              fontSize: "12px",
              fontFamily: "Inter, sans-serif",
            },
            success: { iconTheme: { primary: "#e0a812", secondary: "#16181b" } },
            error:   { iconTheme: { primary: "#dc2626", secondary: "#16181b" } },
          }}
        />
      </body>
    </html>
  );
}
