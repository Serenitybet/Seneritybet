const STORAGE_KEY = "pos-device-secret";

/** Génère un secret d'appareil haute entropie (32 octets). */
export function generateDeviceSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Lecture/écriture directe de localStorage (pas de store zustand persist ici) :
 * l'identité de l'appareil doit être lue de façon synchrone au montage, avant
 * tout appel réseau — l'hydratation asynchrone de zustand/persist créerait
 * sinon une fenêtre où un nouveau secret est généré à chaque rechargement.
 */
export function getStoredDeviceSecret(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function storeDeviceSecret(secret: string): void {
  try { localStorage.setItem(STORAGE_KEY, secret); } catch { /* stockage indisponible */ }
}
