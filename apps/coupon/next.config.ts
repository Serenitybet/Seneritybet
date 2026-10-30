import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  // Une nouvelle version active immédiatement (pas besoin de fermer/rouvrir
  // le site plusieurs fois) — même réglage que apps/pos (TPE).
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
};

export default withPWA(nextConfig);
