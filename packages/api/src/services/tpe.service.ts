import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import { hashDeviceSecret } from "../middleware/tpe.middleware";
import { getSettingNumber, SETTING_KEYS } from "../lib/settings";
import type { Tpe, Ticket, TicketItem, TpeCreditAdjustment } from "@serenitybet/db";

/** Jamais renvoyer deviceSecretHash — c'est un secret d'authentification de l'appareil. */
export function serializeTpe(tpe: Tpe) {
  const { deviceSecretHash: _omit, credit, ...rest } = tpe;
  return { ...rest, creditXAF: Number(credit) / 100 };
}

export function serializeTicket(ticket: Ticket & { items?: TicketItem[] }) {
  const { stake, totalOdds, potentialWin, items, ...rest } = ticket;
  return {
    ...rest,
    stakeXAF: Number(stake) / 100,
    totalOdds: Number(totalOdds),
    potentialWinXAF: Number(potentialWin) / 100,
    ...(items ? { items: items.map((i) => ({ ...i, oddValue: Number(i.oddValue) })) } : {}),
  };
}

export function serializeCreditAdjustment(adj: TpeCreditAdjustment) {
  const { amount, ...rest } = adj;
  return { ...rest, amountXAF: Number(amount) / 100 };
}

const PAIRING_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePairingCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += PAIRING_CHARS[Math.floor(Math.random() * PAIRING_CHARS.length)];
  return code;
}

function generateTicketCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) code += chars[Math.floor(Math.random() * chars.length)];
    if (i < 2) code += "-";
  }
  return code;
}

/** Appelé par un nouvel appareil au premier démarrage — idempotent sur le même secret. */
export async function registerDevice(deviceSecret: string) {
  if (!deviceSecret || deviceSecret.length < 32) {
    throw new AppError(400, "Secret d'appareil invalide");
  }
  const deviceSecretHash = hashDeviceSecret(deviceSecret);

  const existing = await prisma.tpe.findUnique({ where: { deviceSecretHash } });
  if (existing) {
    return { status: existing.status, pairingCode: existing.pairingCode, code: existing.code };
  }

  const count = await prisma.tpe.count();
  const code = `TPE-${String(count + 1).padStart(4, "0")}`;

  let pairingCode = generatePairingCode();
  while (await prisma.tpe.findUnique({ where: { pairingCode } })) pairingCode = generatePairingCode();

  const tpe = await prisma.tpe.create({
    data: { code, deviceSecretHash, pairingCode, status: "PENDING_PAIRING" },
  });

  return { status: tpe.status, pairingCode: tpe.pairingCode, code: tpe.code };
}

interface TicketSelection {
  marketId: string;
  oddId: string;
  oddValue: number;
}

export async function placeTicket(tpeId: string, cashierId: string, selections: TicketSelection[], stakeXAF: number) {
  if (!selections?.length) throw new AppError(400, "Aucune sélection");
  if (selections.length > 15) throw new AppError(400, "Maximum 15 événements par ticket");

  const stake = BigInt(Math.round(stakeXAF * 100));
  if (stake < BigInt(100_00)) throw new AppError(400, "Mise minimum : 100 XAF");

  const oddIds = selections.map((s) => s.oddId);
  const odds = await prisma.odd.findMany({
    where: { id: { in: oddIds }, isActive: true },
    include: { market: { include: { event: true } } },
  });
  if (odds.length !== selections.length) {
    throw new AppError(400, "Une ou plusieurs cotes sont invalides ou suspendues");
  }

  for (const selection of selections) {
    const odd = odds.find((o) => o.id === selection.oddId);
    if (!odd) throw new AppError(400, "Cote introuvable");
    if (odd.market.isSuspended) throw new AppError(400, `Marché suspendu : ${odd.market.name}`);
    if (odd.market.event.status !== "UPCOMING" && odd.market.event.status !== "LIVE") {
      throw new AppError(400, `Événement non disponible : ${odd.market.event.homeTeam} vs ${odd.market.event.awayTeam}`);
    }
    // Le pari en direct n'est pas pris en charge (les cotes ne sont pas mises à
    // jour en temps réel pendant un match) : on refuse tout pari sur un match
    // dont le coup d'envoi est déjà passé, même si l'écran du caissier
    // affichait encore le match avant (données non rafraîchies).
    if (odd.market.event.status === "UPCOMING" && odd.market.event.startTime <= new Date()) {
      throw new AppError(400, `Ce match a déjà débuté, les paris sont fermés : ${odd.market.event.homeTeam} vs ${odd.market.event.awayTeam}`);
    }
    const diff = Math.abs(Number(odd.value) - selection.oddValue);
    if (diff > 0.05) throw new AppError(400, "La cote a changé, veuillez revalider le ticket");
  }

  const totalOdds = odds.reduce((acc, o) => acc * Number(o.value), 1);
  const potentialWin = BigInt(Math.floor(Number(stake) * totalOdds));

  let code = generateTicketCode();
  while (await prisma.ticket.findUnique({ where: { code } })) code = generateTicketCode();

  const ticket = await prisma.ticket.create({
    data: {
      code,
      tpeId,
      cashierId,
      stake,
      totalOdds,
      potentialWin,
      items: {
        create: selections.map((s) => {
          const odd = odds.find((o) => o.id === s.oddId)!;
          return { marketId: s.marketId, oddId: s.oddId, oddValue: Number(odd.value) };
        }),
      },
    },
    include: { items: { include: { market: { include: { event: true } }, odd: true } } },
  });

  return serializeTicket(ticket);
}

export async function listTicketsForTpe(tpeId: string, page: number, limit: number) {
  const where = { tpeId };
  const [total, tickets] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { tickets: tickets.map(serializeTicket), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getTicketByCode(code: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      items: { include: { market: { include: { event: true } }, odd: true } },
      tpe: { select: { code: true, name: true } },
      cashier: { select: { firstName: true, lastName: true } },
    },
  });
  if (!ticket) throw new AppError(404, "Code ticket introuvable");
  return serializeTicket(ticket);
}

/** Règle un ticket une fois tous les résultats connus — ne touche à aucun solde, le paiement se fait en espèces au guichet. */
export async function settleTicket(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { items: true },
  });
  if (!ticket) throw new AppError(404, "Ticket introuvable");
  if (ticket.status !== "PENDING") throw new AppError(400, "Ce ticket est déjà réglé");

  const hasAllResults = ticket.items.every((item) => item.result !== null);
  if (!hasAllResults) throw new AppError(400, "Tous les résultats ne sont pas encore disponibles");

  const won = ticket.items.every((item) => item.result === "WON");
  const voided = ticket.items.every((item) => item.result === "VOID");
  const status = won ? "WON" : voided ? "REFUNDED" : "LOST";

  const threshold = await getSettingNumber(SETTING_KEYS.TPE_PAYOUT_APPROVAL_THRESHOLD_XAF);
  const requiresApproval = won && Number(ticket.potentialWin) > threshold;

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: { status, settledAt: new Date(), requiresApproval },
  });

  return { ticketId: updated.id, status: updated.status, requiresApproval };
}

/** Encaissement — paie un ticket GAGNÉ/REMBOURSÉ au guichet, débite le crédit du TPE payeur. */
export async function payTicket(code: string, tpeId: string, cashierId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { code: code.toUpperCase() } });
  if (!ticket) throw new AppError(404, "Code ticket introuvable");

  if (ticket.status === "PAID") throw new AppError(400, "Ce ticket a déjà été payé");
  if (ticket.status === "CANCELLED") throw new AppError(400, "Ce ticket a été annulé");
  if (ticket.status === "PENDING") throw new AppError(400, "Ce ticket n'est pas encore réglé");
  if (ticket.status === "LOST") throw new AppError(400, "Ce ticket est perdant — rien à payer");

  const amountToPay = ticket.status === "WON" ? ticket.potentialWin : ticket.stake;

  const threshold = await getSettingNumber(SETTING_KEYS.TPE_PAYOUT_APPROVAL_THRESHOLD_XAF);
  if (ticket.status === "WON" && Number(amountToPay) > threshold && !ticket.approvedAt) {
    if (!ticket.requiresApproval) {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { requiresApproval: true } });
    }
    throw new AppError(403, "Ce gain dépasse le seuil autorisé — en attente d'approbation du backoffice");
  }

  const payingTpe = await prisma.tpe.findUnique({ where: { id: tpeId } });
  if (!payingTpe) throw new AppError(404, "TPE payeur introuvable");
  if (payingTpe.credit < amountToPay) {
    throw new AppError(400, "Crédit TPE insuffisant pour ce paiement — contactez le backoffice");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const paid = await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paidByTpeId: tpeId,
        paidByCashierId: cashierId,
      },
    });
    await tx.tpe.update({ where: { id: tpeId }, data: { credit: { decrement: amountToPay } } });
    return paid;
  });

  return { ticketId: updated.id, code: updated.code, amountPaidXAF: Number(amountToPay) / 100 };
}
