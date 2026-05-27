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
              background: "#13161b",
              color: "#e2e8f0",
              border: "1px solid #1e2430",
              borderRadius: "8px",
              fontSize: "12px",
              fontFamily: "Inter, sans-serif",
            },
            success: { iconTheme: { primary: "#22c55e", secondary: "#e2e8f0" } },
            error:   { iconTheme: { primary: "#ef4444", secondary: "#e2e8f0" } },
          }}
        />
      </body>
    </html>
  );
}
