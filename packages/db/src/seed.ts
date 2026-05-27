import { PrismaClient, Role } from "../generated";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Serenitybet database...");

  // ─── Admin ──────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("Admin@2024!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@serenitybet.td" },
    update: {},
    create: {
      email: "admin@serenitybet.td",
      phone: "+23560000001",
      password: adminPassword,
      firstName: "Super",
      lastName: "Admin",
      dateOfBirth: new Date("1990-01-01"),
      role: Role.SUPER_ADMIN,
    },
  });
  console.log("✅ Admin créé:", admin.email);

  // ─── Trader ─────────────────────────────────────────────────────────────
  const traderPassword = await bcrypt.hash("Trader@2024!", 12);
  await prisma.user.upsert({
    where: { email: "trader@serenitybet.td" },
    update: {},
    create: {
      email: "trader@serenitybet.td",
      phone: "+23560000002",
      password: traderPassword,
      firstName: "Trader",
      lastName: "Demo",
      dateOfBirth: new Date("1992-05-15"),
      role: Role.TRADER,
    },
  });

  // ─── Joueur démo ────────────────────────────────────────────────────────
  const playerPassword = await bcrypt.hash("Player@2024!", 12);
  const player = await prisma.user.upsert({
    where: { email: "joueur@demo.td" },
    update: {},
    create: {
      email: "joueur@demo.td",
      phone: "+23561000001",
      password: playerPassword,
      firstName: "Ibrahim",
      lastName: "Mahamat",
      dateOfBirth: new Date("1995-08-20"),
      role: Role.PLAYER,
    },
  });

  // Wallet joueur démo : 50 000 XAF (= 5_000_000 centimes)
  await prisma.wallet.upsert({
    where: { userId: player.id },
    update: {},
    create: {
      userId: player.id,
      balance: BigInt(5_000_000),
    },
  });
  console.log("✅ Joueur démo créé:", player.email);

  // ─── Sports ─────────────────────────────────────────────────────────────
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

  console.log("✅ Sports créés");

  // ─── Compétitions ────────────────────────────────────────────────────────
  const premierLeague = await prisma.competition.upsert({
    where: { slug: "premier-league" },
    update: {},
    create: {
      sportId: football.id,
      name: "Premier League",
      slug: "premier-league",
      country: "Angleterre",
    },
  });

  const championsLeague = await prisma.competition.upsert({
    where: { slug: "champions-league" },
    update: {},
    create: {
      sportId: football.id,
      name: "UEFA Champions League",
      slug: "champions-league",
      country: "Europe",
    },
  });

  const ligue1 = await prisma.competition.upsert({
    where: { slug: "ligue-1" },
    update: {},
    create: {
      sportId: football.id,
      name: "Ligue 1",
      slug: "ligue-1",
      country: "France",
    },
  });

  await prisma.competition.upsert({
    where: { slug: "nba" },
    update: {},
    create: {
      sportId: basketball.id,
      name: "NBA",
      slug: "nba",
      country: "États-Unis",
    },
  });

  console.log("✅ Compétitions créées");

  // ─── Événements démo ────────────────────────────────────────────────────
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(17, 0, 0, 0);

  const event1 = await prisma.event.upsert({
    where: { externalId: "demo-001" },
    update: {},
    create: {
      competitionId: premierLeague.id,
      externalId: "demo-001",
      homeTeam: "Manchester City",
      awayTeam: "Arsenal",
      startTime: tomorrow,
    },
  });

  const inTwoDays = new Date();
  inTwoDays.setDate(inTwoDays.getDate() + 2);
  inTwoDays.setHours(20, 45, 0, 0);

  const event2 = await prisma.event.upsert({
    where: { externalId: "demo-002" },
    update: {},
    create: {
      competitionId: championsLeague.id,
      externalId: "demo-002",
      homeTeam: "Real Madrid",
      awayTeam: "Bayern Munich",
      startTime: inTwoDays,
    },
  });

  const inThreeDays = new Date();
  inThreeDays.setDate(inThreeDays.getDate() + 3);
  inThreeDays.setHours(15, 0, 0, 0);

  const event3 = await prisma.event.upsert({
    where: { externalId: "demo-003" },
    update: {},
    create: {
      competitionId: ligue1.id,
      externalId: "demo-003",
      homeTeam: "Paris Saint-Germain",
      awayTeam: "Olympique de Marseille",
      startTime: inThreeDays,
    },
  });

  // Marchés 1X2 pour chaque événement
  for (const event of [event1, event2, event3]) {
    const existing = await prisma.market.findFirst({
      where: { eventId: event.id, type: "MATCH_WINNER" },
    });
    if (!existing) {
      const market = await prisma.market.create({
        data: {
          eventId: event.id,
          name: "Résultat du match",
          type: "MATCH_WINNER",
        },
      });
      await prisma.odd.createMany({
        data: [
          { marketId: market.id, label: "1", value: 2.1 },
          { marketId: market.id, label: "X", value: 3.4 },
          { marketId: market.id, label: "2", value: 3.6 },
        ],
      });

      const ouMarket = await prisma.market.create({
        data: {
          eventId: event.id,
          name: "Plus/Moins de 2.5 buts",
          type: "OVER_UNDER",
        },
      });
      await prisma.odd.createMany({
        data: [
          { marketId: ouMarket.id, label: "Plus 2.5", value: 1.85 },
          { marketId: ouMarket.id, label: "Moins 2.5", value: 1.95 },
        ],
      });
    }
  }

  console.log("✅ Événements et marchés de démo créés");
  console.log("✅ Seed terminé avec succès !");
  console.log("\n📋 Comptes de démo :");
  console.log("   Admin        : admin@serenitybet.td / Admin@2024!");
  console.log("   Trader       : trader@serenitybet.td / Trader@2024!");
  console.log("   Joueur       : joueur@demo.td / Player@2024! (50 000 XAF)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
