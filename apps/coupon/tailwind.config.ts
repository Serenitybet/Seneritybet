import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Fond clair — mêmes teintes (slate) que apps/pos (TPE) : bg-slate-100
        // en fond général, cartes blanches, en-tête sombre (voir Header.tsx).
        bg: {
          primary:  "#f1f5f9", // slate-100
          secondary:"#ffffff",
          card:     "#ffffff",
          hover:    "#f8fafc", // slate-50
          border:   "#e2e8f0", // slate-200
          input:    "#ffffff",
        },
        green: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        txt: {
          primary:  "#0f172a", // slate-900
          secondary:"#475569", // slate-600
          muted:    "#94a3b8", // slate-400
        },
        live:  "#ef4444",
        gold:  "#f59e0b",
        info:  "#3b82f6",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "green-gradient": "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
        "dark-gradient":  "linear-gradient(180deg, #161b27 0%, #0b0e14 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
