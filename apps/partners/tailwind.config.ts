import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: "#f59e0b",
      },
    },
  },
  plugins: [],
} satisfies Config;
