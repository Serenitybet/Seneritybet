import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Fond principal
        bg: {
          primary:  "#0b0e14",
          secondary:"#111520",
          card:     "#161b27",
          hover:    "#1c2335",
          border:   "#252e42",
          input:    "#1a2030",
        },
        // Vert dominant
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
        // Texte
        txt: {
          primary:  "#f1f5f9",
          secondary:"#94a3b8",
          muted:    "#4b5563",
        },
        // Statuts
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
