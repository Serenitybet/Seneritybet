const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME || 'superadmin';
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`L'utilisateur "${username}" existe déjà, rien à faire.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { username, passwordHash, role: 'SUPER_ADMIN' },
  });

  await prisma.game.upsert({
    where: { key: 'roulette' },
    create: { key: 'roulette', name: 'Roulette européenne', isGlobalActive: true },
    update: {},
  });

  console.log(`Super Admin créé: ${username} / ${password} (à changer immédiatement).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
