import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bo: {
          base:    "#0d0f12",
          card:    "#13161b",
          surface: "#1a1e25",
          input:   "#222730",
          border:  "#1e2430",
          border2: "#2a3240",
        },
        t: {
          primary: "#e2e8f0",
          muted:   "#94a3b8",
          faint:   "#475569",
        },
        green: {
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          900: "#14532d",
        },
        red: {
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          900: "#7f1d1d",
        },
        orange: {
          400: "#fb923c",
          500: "#f97316",
          900: "#7c2d12",
        },
        blue: {
          400: "#60a5fa",
          500: "#3b82f6",
          900: "#1e3a5f",
        },
        gold: "#f5c518",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'DM Mono'", "'Fira Code'", "monospace"],
      },
      backgroundImage: {
        "green-grd": "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
