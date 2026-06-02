import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://seneritybet.onrender.com/api";

export const api = axios.create({ baseURL: API_URL });

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

export function formatXAF(centimes: number): string {
  const xaf = centimes / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(xaf);
}

export function xafToCentimes(xaf: number): number {
  return Math.round(xaf * 100);
}
