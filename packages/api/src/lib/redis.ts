import Redis from "ioredis";

// Redis est optionnel — si Upstash est indisponible au démarrage,
// l'API tourne en mode dégradé (sessions non persistées).
export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  lazyConnect:          true,   // Ne pas se connecter au moment de l'import
  connectTimeout:       8000,   // Abandon après 8s
  maxRetriesPerRequest: 0,      // Pas de retry par requête (fail fast)
  retryStrategy:        () => null, // Pas de reconnexion automatique
  enableReadyCheck:     false,  // Ne pas attendre PING au démarrage
  tls:                  process.env.REDIS_URL?.startsWith("rediss://") ? {} : undefined,
});

let redisAvailable = false;

redis.on("connect", () => {
  redisAvailable = true;
  console.log("✅ Redis connecté");
});
redis.on("error", (err) => {
  if (redisAvailable) {
    console.warn("⚠️  Redis erreur :", err.message);
  }
  redisAvailable = false;
});

export function isRedisAvailable() { return redisAvailable; }

// Helpers pour les sessions (silencieux si Redis indisponible)
export const SESSION_TTL = 60 * 60 * 24 * 7;

export async function setSession(token: string, userId: string): Promise<void> {
  if (!redisAvailable) return;
  try { await redis.setex(`session:${token}`, SESSION_TTL, userId); } catch { /* dégradé */ }
}

export async function getSession(token: string): Promise<string | null> {
  if (!redisAvailable) return null;
  try { return await redis.get(`session:${token}`); } catch { return null; }
}

export async function deleteSession(token: string): Promise<void> {
  if (!redisAvailable) return;
  try { await redis.del(`session:${token}`); } catch { /* dégradé */ }
}

// Cache pour les cotes (TTL court)
export const ODDS_CACHE_TTL = 30;

export async function cacheOdds(eventId: string, data: unknown): Promise<void> {
  if (!redisAvailable) return;
  try { await redis.setex(`odds:${eventId}`, ODDS_CACHE_TTL, JSON.stringify(data)); } catch { /* dégradé */ }
}

export async function getCachedOdds(eventId: string): Promise<unknown | null> {
  if (!redisAvailable) return null;
  try {
    const raw = await redis.get(`odds:${eventId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
