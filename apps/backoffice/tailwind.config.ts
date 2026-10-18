import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bo: {
          base:    "#eef0f3",
          card:    "#ffffff",
          surface: "#f6f7f9",
          input:   "#ffffff",
          border:  "#e3e6ea",
          border2: "#d1d5db",
        },
        t: {
          primary: "#16181b",
          muted:   "#5b6168",
          faint:   "#9aa0a8",
        },
        green: {
          400: "#f3cb4d",
          500: "#e0a812",
          600: "#b4890c",
          700: "#8a6809",
          900: "#4d3a05",
        },
        red: {
          400: "#f87171",
          500: "#dc2626",
          600: "#b91c1c",
          900: "#7f1d1d",
        },
        orange: {
          400: "#fb923c",
          500: "#ea580c",
          900: "#7c2d12",
        },
        blue: {
          400: "#60a5fa",
          500: "#2563eb",
          900: "#1e3a5f",
        },
        gold: "#eab308",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'DM Mono'", "'Fira Code'", "monospace"],
      },
      backgroundImage: {
        "green-grd": "linear-gradient(135deg, #f0c419 0%, #d4a017 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
