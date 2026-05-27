/**
 * Seed script — Serenitybet
 * Crée les utilisateurs admin/trader/finance + sports de base + matchs de démo
 *
 * Usage : pnpm db:seed
 */

import { PrismaClient } from "../generated";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Démarrage du seed...");

  // ─── Utilisateurs admin ────────────────────────────────────────────────────

  const adminPassword  = await bcrypt.hash("Admin@2024!",  12);
  const traderPassword = await bcrypt.hash("Trader@2024!", 12);
  const financePassword = await bcrypt.hash("Finance@2024!", 12);
  const playerPassword  = await bcrypt.hash("Player@2024!", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@serenitybet.td" },
    update: { password: adminPassword },
    create: {
      email:       "admin@serenitybet.td",
      phone:       "+23566000001",
      password:    adminPassword,
      firstName:   "Super",
      lastName:    "Admin",
      dateOfBirth: new Date("1985-01-01"),
      role:        "SUPER_ADMIN",
      status:      "ACTIVE",
      kycStatus:   "APPROVED",
      wallet: { create: { balance: BigInt(0) } },
    },
  });
  console.log("✅ Admin créé :", adminUser.email);

  const traderUser = await prisma.user.upsert({
    where: { email: "trader@serenitybet.td" },
    update: { password: traderPassword },
    create: {
      email:       "trader@serenitybet.td",
      phone:       "+23566000002",
      password:    traderPassword,
      firstName:   "Mohamed",
      lastName:    "Trader",
      dateOfBirth: new Date("1990-06-15"),
      role:        "TRADER",
      status:      "ACTIVE",
      kycStatus:   "APPROVED",
      wallet: { create: { balance: BigInt(0) } },
    },
  });
  console.log("✅ Trader créé :", traderUser.email);

  const financeUser = await prisma.user.upsert({
    where: { email: "finance@serenitybet.td" },
    update: { password: financePassword },
    create: {
      email:       "finance@serenitybet.td",
      phone:       "+23566000003",
      password:    financePassword,
      firstName:   "Fatima",
      lastName:    "Finance",
      dateOfBirth: new Date("1992-03-20"),
      role:        "FINANCE",
      status:      "ACTIVE",
      kycStatus:   "APPROVED",
      wallet: { create: { balance: BigInt(0) } },
    },
  });
  console.log("✅ Finance créé :", financeUser.email);

  // Joueur de démo avec solde
  const playerUser = await prisma.user.upsert({
    where: { email: "joueur@serenitybet.td" },
    update: {},
    create: {
      email:       "joueur@serenitybet.td",
      phone:       "+23599000001",
      password:    playerPassword,
      firstName:   "Ibrahim",
      lastName:    "Mahamat",
      dateOfBirth: new Date("1995-07-10"),
      role:        "PLAYER",
      status:      "ACTIVE",
      kycStatus:   "APPROVED",
      wallet: { create: { balance: BigInt(5000000) } }, // 50 000 XAF
    },
  });
  console.log("✅ Joueur démo créé :", playerUser.email);

  // ─── Sports ───────────────────────────────────────────────────────────────

  const football = await prisma.sport.upsert({
    where: { slug: "football" },
    update: {},
    create: { name: "Football", slug: "football", icon: "⚽", sortOrder: 1 },
  });

  const basketball = await prisma.sport.upsert({
    where: { slug: "basketball" },
    update: {},
    create: { name: "Basketball", slug: "basketball", icon: "🏀", sortOrder: 2 },
  });

  const tennis = await prisma.sport.upsert({
    where: { slug: "tennis" },
    update: {},
    create: { name: "Tennis", slug: "tennis", icon: "🎾", sortOrder: 3 },
  });
  console.log("✅ Sports créés : football, basketball, tennis");

  // ─── Compétitions ─────────────────────────────────────────────────────────

  const comps = [
    { sportId: football.id,    name: "Premier League",      slug: "premier-league",      country: "England" },
    { sportId: football.id,    name: "Ligue des Champions", slug: "champions-league",     country: "Europe" },
    { sportId: football.id,    name: "Ligue 1",             slug: "ligue-1",              country: "France" },
    { sportId: football.id,    name: "La Liga",             slug: "la-liga",              country: "Spain" },
    { sportId: football.id,    name: "Serie A",             slug: "serie-a",              country: "Italy" },
    { sportId: football.id,    name: "Bundesliga",          slug: "bundesliga",           country: "Germany" },
    { sportId: basketball.id,  name: "NBA",                 slug: "nba",                  country: "USA" },
    { sportId: tennis.id,      name: "ATP Tour",            slug: "atp-tour",             country: "International" },
  ];

  for (const c of comps) {
    await prisma.competition.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
  }
  console.log("✅ Compétitions créées");

  // ─── Événements de démonstration ─────────────────────────────────────────

  const premierLeague = await prisma.competition.findUnique({ where: { slug: "premier-league" } });
  const championsLeague = await prisma.competition.findUnique({ where: { slug: "champions-league" } });

  if (premierLeague) {
    const matches = [
      { homeTeam: "Arsenal",       awayTeam: "Chelsea",    hoursFromNow: 2 },
      { homeTeam: "Manchester City", awayTeam: "Liverpool", hoursFromNow: 4 },
      { homeTeam: "Tottenham",     awayTeam: "Everton",    hoursFromNow: 24 },
    ];

    for (const m of matches) {
      const startTime = new Date(Date.now() + m.hoursFromNow * 3600 * 1000);
      const existing = await prisma.event.findFirst({
        where: { homeTeam: m.homeTeam, awayTeam: m.awayTeam, competitionId: premierLeague.id },
      });

      if (!existing) {
        const event = await prisma.event.create({
          data: {
            competitionId: premierLeague.id,
            homeTeam:  m.homeTeam,
            awayTeam:  m.awayTeam,
            startTime,
            status: "UPCOMING",
          },
        });

        // Marché 1X2
        const market = await prisma.market.create({
          data: {
            eventId: event.id,
            name:    "Résultat du match",
            type:    "MATCH_WINNER",
          },
        });

        // Cotes de démonstration
        await prisma.odd.createMany({
          data: [
            { marketId: market.id, label: "1", value: 2.10 },
            { marketId: market.id, label: "X", value: 3.40 },
            { marketId: market.id, label: "2", value: 3.20 },
          ],
        });
      }
    }
    console.log("✅ Matchs Premier League créés");
  }

  if (championsLeague) {
    const existing = await prisma.event.findFirst({
      where: { homeTeam: "Real Madrid", competitionId: championsLeague.id },
    });

    if (!existing) {
      const event = await prisma.event.create({
        data: {
          competitionId: championsLeague.id,
          homeTeam:  "Real Madrid",
          awayTeam:  "Bayern Munich",
          startTime: new Date(Date.now() + 6 * 3600 * 1000),
          status:    "UPCOMING",
        },
      });

      const market = await prisma.market.create({
        data: { eventId: event.id, name: "Résultat du match", type: "MATCH_WINNER" },
      });

      await prisma.odd.createMany({
        data: [
          { marketId: market.id, label: "1", value: 2.35 },
          { marketId: market.id, label: "X", value: 3.60 },
          { marketId: market.id, label: "2", value: 2.85 },
        ],
      });
    }
    console.log("✅ Match Ligue des Champions créé");
  }

  console.log("\n🎉 Seed terminé avec succès !");
  console.log("\nComptes de connexion :");
  console.log("  Admin     : admin@serenitybet.td    / Admin@2024!");
  console.log("  Trader    : trader@serenitybet.td   / Trader@2024!");
  console.log("  Finance   : finance@serenitybet.td  / Finance@2024!");
  console.log("  Joueur    : joueur@serenitybet.td   / Player@2024!");
}

main()
  .catch((e) => { console.error("❌ Seed error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
