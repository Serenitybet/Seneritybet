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

  const placingTpe = await prisma.tpe.findUnique({ where: { id: tpeId } });
  if (!placingTpe) throw new AppError(404, "TPE introuvable");
  if (placingTpe.credit < stake) {
    throw new AppError(400, "Crédit TPE insuffisant pour cette mise — contactez le backoffice");
  }

  let code = generateTicketCode();
  while (await prisma.ticket.findUnique({ where: { code } })) code = generateTicketCode();

  // La mise est déduite du crédit du TPE (le caissier "immobilise" ce montant
  // en l'encaissant) ; elle y revient, majorée du gain, au moment du paiement
  // d'un ticket gagnant (voir payTicket).
  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
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
      include: {
        items: { include: { market: { include: { event: true } }, odd: true } },
        tpe: { select: { code: true, name: true } },
      },
    });
    await tx.tpe.update({ where: { id: tpeId }, data: { credit: { decrement: stake } } });
    return created;
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

/**
 * Synthèse caissier sur une période : total des tickets émis (mises collectées)
 * et total des tickets payés (gains/remboursements versés) par ce caissier sur
 * ce TPE — pour la clôture de caisse.
 */
export async function getCashierSummary(tpeId: string, cashierId: string, from: Date, to: Date) {
  const [issuedTickets, paidTickets] = await Promise.all([
    prisma.ticket.findMany({
      where: { tpeId, cashierId, createdAt: { gte: from, lte: to } },
      select: { stake: true },
    }),
    prisma.ticket.findMany({
      where: { paidByTpeId: tpeId, paidByCashierId: cashierId, paidAt: { gte: from, lte: to } },
      select: { stake: true, potentialWin: true, items: { select: { result: true } } },
    }),
  ]);

  const issuedTotal = issuedTickets.reduce((acc, t) => acc + t.stake, BigInt(0));
  // Le statut du ticket passe à PAID une fois encaissé, donc on ne peut plus
  // s'y fier pour savoir s'il s'agissait d'un gain (payé = gain potentiel)
  // ou d'un remboursé (payé = mise) — on se base plutôt sur les résultats
  // de ses sélections, qui eux ne changent plus après le règlement.
  const paidTotal = paidTickets.reduce((acc, t) => {
    const won = t.items.length > 0 && t.items.every((i) => i.result === "WON");
    return acc + (won ? t.potentialWin : t.stake);
  }, BigInt(0));

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    issuedCount: issuedTickets.length,
    issuedTotalXAF: Number(issuedTotal) / 100,
    paidCount: paidTickets.length,
    paidTotalXAF: Number(paidTotal) / 100,
    netXAF: Number(issuedTotal - paidTotal) / 100,
  };
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

  // Le paiement d'un ticket (gagnant ou remboursé) ravitaille le crédit du
  // TPE payeur — c'est l'inverse de la mise déduite à la création du ticket
  // (voir placeTicket) : le caissier récupère sa mise immobilisée, majorée
  // du gain le cas échéant.
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
    await tx.tpe.update({ where: { id: tpeId }, data: { credit: { increment: amountToPay } } });
    return paid;
  });

  return { ticketId: updated.id, code: updated.code, amountPaidXAF: Number(amountToPay) / 100 };
}

/** Approuve un ticket gagnant dont le gain dépasse le seuil — débloque son paiement au guichet. */
export async function approveTicket(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new AppError(404, "Ticket introuvable");
  if (ticket.status !== "WON") throw new AppError(400, "Seul un ticket gagnant peut être approuvé");
  if (ticket.approvedAt) throw new AppError(400, "Ce ticket est déjà approuvé");

  const updated = await prisma.ticket.update({ where: { id: ticketId }, data: { approvedAt: new Date() } });
  return { ticketId: updated.id, approvedAt: updated.approvedAt };
}
