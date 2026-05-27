import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Serenitybet — Paris Sportifs au Tchad",
  description: "Pariez sur vos sports préférés avec Serenitybet, la plateforme de paris sportifs de confiance au Tchad.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className={`${inter.className} bg-bg-primary text-txt-primary min-h-screen`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#161b27",
              color: "#f1f5f9",
              border: "1px solid #252e42",
              borderRadius: "10px",
              fontSize: "13px",
            },
            success: { iconTheme: { primary: "#16a34a", secondary: "#f1f5f9" } },
            error:   { iconTheme: { primary: "#ef4444", secondary: "#f1f5f9" } },
          }}
        />
      </body>
    </html>
  );
}
