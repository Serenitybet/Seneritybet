import { app } from "./app";
import { redis } from "./lib/redis";
import { prisma } from "./lib/prisma";
import { startOddsSyncWorker } from "./workers/odds-sync.worker";

const PORT = parseInt(process.env.API_PORT ?? "4000", 10);

async function bootstrap() {
  // ── PostgreSQL (obligatoire) ──────────────────────────────────────────────
  try {
    await prisma.$connect();
    console.log("✅ PostgreSQL connecté");
  } catch (err) {
    console.error("❌ Impossible de se connecter à PostgreSQL :", err);
    process.exit(1);
  }

  // ── Redis (optionnel — connexion en arrière-plan, non bloquante) ──────────
  redis.connect().then(() => {
    // succès loggé par l'event "connect"
  }).catch(() => {
    console.warn("⚠️  Redis non disponible — mode dégradé (sessions en mémoire uniquement)");
  });

  // ── Worker de sync cotes (non bloquant) ──────────────────────────────────
  if (process.env.NODE_ENV !== "test") {
    try {
      startOddsSyncWorker();
      console.log("✅ Worker de sync des cotes démarré");
    } catch (err) {
      console.warn("⚠️  Worker cotes non démarré :", err);
    }
  }

  // ── Démarrage Express ─────────────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`\n🚀 API Serenitybet démarrée — http://localhost:${PORT}`);
    console.log(`   Health : http://localhost:${PORT}/health\n`);
  });
}

bootstrap().catch((err) => {
  console.error("❌ Erreur fatale au démarrage :", err);
  process.exit(1);
});
