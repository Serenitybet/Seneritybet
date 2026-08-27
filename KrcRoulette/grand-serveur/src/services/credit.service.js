const prisma = require('../config/prisma');

class InsufficientCreditError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

async function getSuperAdminCredit(tx = prisma) {
  return tx.superAdminCredit.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', balance: 0 },
    update: {},
  });
}

// Super Admin s'attribue/ajuste son propre crédit (source de la cascade)
async function setSuperAdminBalance(amount) {
  return prisma.superAdminCredit.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', balance: amount },
    update: { balance: amount },
  });
}

async function superToVille({ villeId, amount, performedByUserId, note }) {
  if (amount <= 0) throw new InsufficientCreditError('Le montant doit être positif');

  return prisma.$transaction(async (tx) => {
    const superCredit = await getSuperAdminCredit(tx);
    if (superCredit.balance < amount) {
      throw new InsufficientCreditError('Crédit Super Admin insuffisant');
    }

    await tx.superAdminCredit.update({
      where: { id: 'singleton' },
      data: { balance: { decrement: amount } },
    });

    const ville = await tx.ville.update({
      where: { id: villeId },
      data: { creditBalance: { increment: amount } },
    });

    const transaction = await tx.creditTransaction.create({
      data: {
        type: 'SUPER_TO_VILLE',
        villeId,
        amount,
        balanceAfter: ville.creditBalance,
        performedByUserId,
        note,
      },
    });

    return { ville, transaction };
  });
}

async function villeToShop({ villeId, shopId, amount, performedByUserId, note }) {
  if (amount <= 0) throw new InsufficientCreditError('Le montant doit être positif');

  return prisma.$transaction(async (tx) => {
    const ville = await tx.ville.findUnique({ where: { id: villeId } });
    if (!ville || ville.creditBalance < amount) {
      throw new InsufficientCreditError('Crédit Ville insuffisant');
    }

    const shop = await tx.shop.findFirst({ where: { id: shopId, villeId } });
    if (!shop) throw new InsufficientCreditError("Ce shop n'appartient pas à cette ville");

    await tx.ville.update({ where: { id: villeId }, data: { creditBalance: { decrement: amount } } });

    const updatedShop = await tx.shop.update({
      where: { id: shopId },
      data: { creditBalance: { increment: amount } },
    });

    const transaction = await tx.creditTransaction.create({
      data: {
        type: 'VILLE_TO_SHOP',
        villeId,
        shopId,
        amount,
        balanceAfter: updatedShop.creditBalance,
        performedByUserId,
        note,
      },
    });

    return { shop: updatedShop, transaction };
  });
}

// Débit lors de l'enregistrement d'une mise (peut rendre le solde négatif si non bloqué en amont)
async function debitShopForBet({ shopId, amount, performedByUserId, note, tx = prisma }) {
  const shop = await tx.shop.update({
    where: { id: shopId },
    data: { creditBalance: { decrement: amount } },
  });

  await tx.creditTransaction.create({
    data: {
      type: 'SHOP_DEBIT_BET',
      shopId,
      amount,
      balanceAfter: shop.creditBalance,
      performedByUserId,
      note,
    },
  });

  return shop;
}

// Crédit lors du paiement d'un ticket gagnant
async function creditShopForPayout({ shopId, amount, performedByUserId, note, tx = prisma }) {
  const shop = await tx.shop.update({
    where: { id: shopId },
    data: { creditBalance: { increment: amount } },
  });

  await tx.creditTransaction.create({
    data: {
      type: 'SHOP_CREDIT_PAYOUT',
      shopId,
      amount,
      balanceAfter: shop.creditBalance,
      performedByUserId,
      note,
    },
  });

  return shop;
}

async function getHistory({ shopId, villeId, limit = 100 }) {
  return prisma.creditTransaction.findMany({
    where: {
      ...(shopId ? { shopId } : {}),
      ...(villeId ? { villeId } : {}),
    },
    include: { performedByUser: { select: { username: true } }, shop: true, ville: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

module.exports = {
  InsufficientCreditError,
  getSuperAdminCredit,
  setSuperAdminBalance,
  superToVille,
  villeToShop,
  debitShopForBet,
  creditShopForPayout,
  getHistory,
};
