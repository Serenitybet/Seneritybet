import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import { hashDeviceSecret } from "../middleware/tpe.middleware";
import { getSettingNumber, SETTING_KEYS } from "../lib/settings";
import type { Tpe, Ticket, TicketItem, TpeCreditAdjustment, Region } from "@serenitybet/db";

/** Jamais renvoyer deviceSecretHash — c'est un secret d'authentification de l'appareil. */
export function serializeTpe(tpe: Tpe & { region?: Pick<Region, "id" | "name"> | null }) {
  const { deviceSecretHash: _omit, credit, dailyCreditXAF, ...rest } = tpe;
  return {
    ...rest,
    creditXAF: Number(credit) / 100,
    // BigInt ne se sérialise pas nativement en JSON — même traitement que
    // credit ci-dessus.
    dailyCreditXAF: dailyCreditXAF != null ? Number(dailyCreditXAF) / 100 : null,
  };
}

/** Ne jamais renvoyer payoutCode ici — c'est le secret qui protège contre le paiement d'une réimpression (voir placeTicket, qui le renvoie une seule fois, à part). */
export function serializeTicket(ticket: Ticket & { items?: TicketItem[] }) {
  const { stake, totalOdds, potentialWin, cashedOutAmount, items, payoutCode: _omit, ...rest } = ticket;
  return {
    ...rest,
    stakeXAF: Number(stake) / 100,
    totalOdds: Number(totalOdds),
    potentialWinXAF: Number(potentialWin) / 100,
    // BigInt ne se sérialise pas nativement en JSON (res.json plante sinon)
    // — même traitement que stake/potentialWin ci-dessus.
    cashedOutAmountXAF: cashedOutAmount != null ? Number(cashedOutAmount) / 100 : null,
    ...(items ? { items: items.map((i) => ({ ...i, oddValue: Number(i.oddValue) })) } : {}),
  };
}

export function serializeCreditAdjustment(adj: TpeCreditAdjustment) {
  const { amount, ...rest } = adj;
  return { ...rest, amountXAF: Number(amount) / 100 };
}

// Tchad = UTC+1 toute l'année (pas d'heure d'été) — décalage fixe, pas besoin
// d'une bibliothèque de fuseaux horaires pour ce seul calcul.
const CHAD_UTC_OFFSET_MS = 60 * 60 * 1000;

/** Instant UTC correspondant à minuit (heure du Tchad) du jour courant. */
function todayMidnightChad(): Date {
  const chadNow = new Date(Date.now() + CHAD_UTC_OFFSET_MS);
  const chadMidnightAsUTC = Date.UTC(chadNow.getUTCFullYear(), chadNow.getUTCMonth(), chadNow.getUTCDate());
  return new Date(chadMidnightAsUTC - CHAD_UTC_OFFSET_MS);
}

/**
 * Remet le crédit de chaque TPE ayant un palier journalier configuré
 * (dailyCreditXAF) à cette valeur, une fois par jour à partir de minuit
 * (heure du Tchad) — demande explicite du 30/10/2026 : un caissier ne doit
 * plus se retrouver bloqué en pleine journée en attendant une recharge
 * manuelle, il reçoit un palier frais chaque jour.
 *
 * C'est une REMISE À ZÉRO (pas un ajout) : le crédit est posé exactement à
 * dailyCreditXAF, quel que soit ce qu'il restait. Appelé périodiquement
 * (voir credit-reset.worker.ts) plutôt que programmé précisément à minuit :
 * plus simple et rattrape automatiquement toute réinitialisation manquée
 * (panne/redémarrage du serveur ayant couvert minuit), au prix d'un délai
 * de quelques minutes au pire.
 */
export async function resetDailyCreditsIfDue() {
  const dueSince = todayMidnightChad();
  const due = await prisma.tpe.findMany({
    where: {
      dailyCreditXAF: { not: null },
      OR: [{ lastDailyResetAt: null }, { lastDailyResetAt: { lt: dueSince } }],
    },
  });

  for (const tpe of due) {
    const target = tpe.dailyCreditXAF!;
    const delta = target - tpe.credit;
    const now = new Date();
    await prisma.$transaction([
      prisma.tpe.update({ where: { id: tpe.id }, data: { credit: target, lastDailyResetAt: now } }),
      prisma.tpeCreditAdjustment.create({
        data: { tpeId: tpe.id, amount: delta, reason: "Réinitialisation journalière automatique (00h, heure du Tchad)" },
      }),
    ]);
  }

  return { resetCount: due.length };
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

function generatePayoutCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
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

export async function placeTicket(
  tpeId: string,
  cashierId: string,
  selections: TicketSelection[],
  stakeXAF: number,
  webCouponCode?: string,
  // true = le caissier a déjà vu les nouvelles cotes (voir changedOdds
  // ci-dessous, affichées en rouge/vert côté apps/pos) et confirme malgré le
  // changement — demande explicite du 31/10/2026 : un coupon composé sur le
  // site, puis des cotes ayant bougé avant que la caissière ne finalise au
  // TPE, bloquait entièrement l'impression sans alternative.
  confirmOddsChange = false,
) {
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

  // Un seul pari par MARCHÉ sur un même ticket (pas deux issues du même
  // marché, ex. "1" et "X" du même 1X2 — mutuellement exclusives) ; plusieurs
  // marchés différents du même match peuvent en revanche cohabiter (ex. 1X2
  // + plus/moins + BTTS, demande explicite du 31/10/2026). Revalidé ici
  // côté serveur, pas seulement côté écran caissier, qui n'est qu'une aide
  // à la saisie.
  const marketKeys = odds.map((o) => `${o.market.event.id}:${o.marketId}`);
  if (new Set(marketKeys).size !== marketKeys.length) {
    throw new AppError(400, "Une seule sélection par marché est autorisée sur un même ticket");
  }

  // Cotes ayant bougé depuis la composition du coupon (sur le site, ou
  // depuis que le caissier a affiché le match) — collectées plutôt que de
  // bloquer au premier écart trouvé, pour les montrer TOUTES d'un coup à la
  // caissière plutôt qu'un aller-retour par cote changée.
  const changedOdds: { eventLabel: string; marketName: string; oldValue: number; newValue: number }[] = [];
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
    // affichait encore le match avant (données non rafraîchies). Jamais
    // contournable par confirmOddsChange — ce n'est pas une cote qui a
    // bougé, c'est un match qui ne peut plus être parié du tout.
    if (odd.market.event.status === "UPCOMING" && odd.market.event.startTime <= new Date()) {
      throw new AppError(400, `Ce match a déjà débuté, les paris sont fermés : ${odd.market.event.homeTeam} vs ${odd.market.event.awayTeam}`);
    }
    const diff = Math.abs(Number(odd.value) - selection.oddValue);
    if (diff > 0.05) {
      changedOdds.push({
        eventLabel: `${odd.market.event.homeTeam} vs ${odd.market.event.awayTeam}`,
        marketName: odd.market.name,
        oldValue: selection.oddValue,
        newValue: Number(odd.value),
      });
    }
  }
  if (changedOdds.length > 0 && !confirmOddsChange) {
    throw new AppError(400, "Une ou plusieurs cotes ont changé depuis la composition du coupon", { changedOdds });
  }

  const totalOdds = odds.reduce((acc, o) => acc * Number(o.value), 1);
  const potentialWin = BigInt(Math.floor(Number(stake) * totalOdds));

  const placingTpe = await prisma.tpe.findUnique({ where: { id: tpeId }, include: { region: true } });
  if (!placingTpe) throw new AppError(404, "TPE introuvable");
  if (placingTpe.credit < stake) {
    throw new AppError(400, "Crédit TPE insuffisant pour cette mise — contactez le backoffice");
  }

  // Gestion de risque : refus à la source si le gain potentiel dépasse le
  // plafond configuré (backoffice → Gestion du risque), plutôt qu'un
  // paiement bloqué a posteriori — évite d'avoir à payer moins que ce que
  // les cotes affichées promettaient. Mise maximale suggérée renvoyée pour
  // que le caissier puisse ajuster directement. Le plafond de la région du
  // TPE prévaut sur le réglage global quand il est explicitement défini
  // (null = la région hérite du plafond global).
  const maxWin = placingTpe.region?.maxWinXAF != null
    ? Number(placingTpe.region.maxWinXAF)
    : await getSettingNumber(SETTING_KEYS.TPE_MAX_WIN_XAF);
  if (maxWin > 0 && Number(potentialWin) > maxWin) {
    const maxStakeXAF = Math.floor(maxWin / totalOdds / 100);
    throw new AppError(
      400,
      `Le gain potentiel de ce coupon dépasse le plafond autorisé (${(maxWin / 100).toLocaleString("fr-FR")} XAF). Mise maximale pour ce coupon : ${maxStakeXAF.toLocaleString("fr-FR")} XAF.`,
      { maxStakeXAF, maxWinXAF: maxWin / 100 },
    );
  }

  let code = generateTicketCode();
  while (await prisma.ticket.findUnique({ where: { code } })) code = generateTicketCode();
  const payoutCode = generatePayoutCode();

  // La mise est déduite du crédit du TPE à la vente — le paiement d'un
  // ticket gagnant/remboursé n'y touche plus (voir payTicket, demande
  // explicite du 30/10/2026) : le crédit ne reflète donc que les ventes, pas
  // les paiements au guichet (qui restent visibles séparément sur la caisse
  // du jour, voir getCashierSummary). La vérification plus haut est une
  // lecture faite avant la transaction — sous forte concurrence (plusieurs
  // tickets créés presque simultanément sur le même TPE), elle peut être
  // périmée au moment où la transaction s'exécute. La déduction ci-dessous
  // est donc conditionnée (WHERE credit >= stake) et revérifiée : c'est elle,
  // pas le contrôle initial, qui garantit que le crédit ne passe jamais sous
  // zéro.
  const ticket = await prisma.$transaction(async (tx) => {
    const deducted = await tx.tpe.updateMany({
      where: { id: tpeId, credit: { gte: stake } },
      data: { credit: { decrement: stake } },
    });
    if (deducted.count === 0) {
      throw new AppError(400, "Crédit TPE insuffisant pour cette mise — contactez le backoffice");
    }

    // Coupon web d'origine, le cas échéant — volontairement réutilisable
    // jusqu'à expiration (un parieur peut partager son code avec des amis,
    // chacun le fait alors retirer séparément avec sa propre mise), donc
    // une simple lecture suffit ici : pas de verrou anti-réemploi à poser.
    let webCouponId: string | undefined;
    if (webCouponCode) {
      const coupon = await tx.webCoupon.findUnique({ where: { code: webCouponCode.toUpperCase() } });
      if (!coupon || coupon.status === "CANCELLED" || coupon.status === "EXPIRED" || coupon.expiresAt <= new Date()) {
        throw new AppError(400, "Ce coupon web est invalide, annulé ou a expiré");
      }
      webCouponId = coupon.id;
    }

    const created = await tx.ticket.create({
      data: {
        code,
        payoutCode,
        tpeId,
        cashierId,
        stake,
        totalOdds,
        potentialWin,
        webCouponId,
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

    return created;
  });

  // Le code de validation n'est renvoyé qu'ici, une seule fois, pour être
  // imprimé sur le ticket ORIGINAL — serializeTicket l'exclut partout
  // ailleurs (recherche, historique, encaissement).
  return { ...serializeTicket(ticket), payoutCode };
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
      select: { stake: true, potentialWin: true, cashedOutAmount: true, items: { select: { result: true } } },
    }),
  ]);

  const issuedTotal = issuedTickets.reduce((acc, t) => acc + t.stake, BigInt(0));
  // Le statut du ticket passe à PAID une fois encaissé, donc on ne peut plus
  // s'y fier pour savoir s'il s'agissait d'un gain (payé = gain potentiel)
  // ou d'un remboursé (payé = mise) — on se base plutôt sur les résultats
  // de ses sélections, qui eux ne changent plus après le règlement.
  const paidTotal = paidTickets.reduce((acc, t) => {
    // Un cash-out verse un montant distinct (voir payCashout) — ni la mise
    // ni le gain potentiel, qu'on ignore totalement dans ce cas.
    if (t.cashedOutAmount != null) return acc + t.cashedOutAmount;
    // Une sélection VOID (push, match annulé) ne change pas l'issue — voir
    // settleTicket. On exclut seulement les tickets avec une sélection
    // perdue, ou sans aucune sélection gagnante (tout VOID = remboursé).
    const won = t.items.some((i) => i.result === "WON") && t.items.every((i) => i.result !== "LOST");
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

/**
 * Rapport consolidé — une ligne par TPE (ventes, tickets, paiements) sur une
 * période, tous TPE confondus — demande explicite du 31/10/2026 : exporter
 * les données de TOUS les TPE en une seule fois plutôt qu'un TPE à la fois.
 * Mêmes règles de calcul que getCashierSummary (cash-out = montant versé
 * distinct de la mise/du gain, VOID neutre), agrégées ici par TPE plutôt que
 * par TPE+caissier individuel.
 */
export async function getTpeSummaryReport(from: Date, to: Date) {
  const [tpes, issuedTickets, paidTickets] = await Promise.all([
    prisma.tpe.findMany({
      where: { status: { not: "DELETED" } },
      include: { region: { select: { name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.ticket.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { tpeId: true, stake: true },
    }),
    prisma.ticket.findMany({
      where: { paidByTpeId: { not: null }, paidAt: { gte: from, lte: to } },
      select: { paidByTpeId: true, stake: true, potentialWin: true, cashedOutAmount: true, items: { select: { result: true } } },
    }),
  ]);

  const issuedByTpe = new Map<string, { count: number; total: bigint }>();
  for (const t of issuedTickets) {
    const cur = issuedByTpe.get(t.tpeId) ?? { count: 0, total: BigInt(0) };
    cur.count += 1;
    cur.total += t.stake;
    issuedByTpe.set(t.tpeId, cur);
  }

  const paidByTpe = new Map<string, { count: number; total: bigint }>();
  for (const t of paidTickets) {
    const tpeId = t.paidByTpeId!;
    const cur = paidByTpe.get(tpeId) ?? { count: 0, total: BigInt(0) };
    let amount: bigint;
    if (t.cashedOutAmount != null) {
      amount = t.cashedOutAmount;
    } else {
      const won = t.items.some((i) => i.result === "WON") && t.items.every((i) => i.result !== "LOST");
      amount = won ? t.potentialWin : t.stake;
    }
    cur.count += 1;
    cur.total += amount;
    paidByTpe.set(tpeId, cur);
  }

  return tpes.map((tpe) => {
    const issued = issuedByTpe.get(tpe.id) ?? { count: 0, total: BigInt(0) };
    const paid = paidByTpe.get(tpe.id) ?? { count: 0, total: BigInt(0) };
    return {
      tpeId: tpe.id,
      tpeCode: tpe.code,
      tpeName: tpe.name,
      regionName: tpe.region?.name ?? null,
      status: tpe.status,
      issuedCount: issued.count,
      issuedTotalXAF: Number(issued.total) / 100,
      paidCount: paid.count,
      paidTotalXAF: Number(paid.total) / 100,
      netXAF: Number(issued.total - paid.total) / 100,
    };
  });
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

  // Une seule sélection PERDUE suffit à clôturer tout le ticket en LOST,
  // même si d'autres sélections du combiné ne sont pas encore jouées —
  // inutile d'attendre le résultat de matchs qui ne changeront plus rien à
  // l'issue. Sans ce court-circuit, un ticket avec une sélection déjà
  // perdue restait affiché "en cours" jusqu'à ce que TOUTES les autres
  // rencontres se terminent, parfois des jours plus tard (signalé en prod
  // le 30/10/2026).
  const anyLost = ticket.items.some((item) => item.result === "LOST");
  const hasAllResults = ticket.items.every((item) => item.result !== null);
  if (!hasAllResults && !anyLost) {
    throw new AppError(400, "Tous les résultats ne sont pas encore disponibles");
  }

  // Une sélection ANNULÉE (VOID — match reporté/annulé, push) ne doit pas
  // faire perdre le ticket : seule une sélection explicitement PERDUE le
  // fait. S'il n'y a que des VOID (match bien complet), le ticket est
  // entièrement remboursé ; sinon (au moins une sélection WON, les autres
  // WON ou VOID), il est gagnant. "allVoided" n'a de sens que si tous les
  // résultats sont connus — jamais vrai sur un règlement anticipé (anyLost).
  const allVoided = hasAllResults && ticket.items.every((item) => item.result === "VOID");
  const status = anyLost ? "LOST" : allVoided ? "REFUNDED" : "WON";

  // Une sélection VOID équivaut à une cote neutre de 1 — elle ne doit pas
  // compter sa cote d'origine dans le gain. On recalcule donc la cote et le
  // gain effectifs au règlement en ne multipliant que les cotes des
  // sélections WON, au lieu de garder potentialWin figé depuis la mise
  // (qui inclurait à tort la cote d'une sélection ensuite annulée).
  const effectiveOdds = status === "WON"
    ? ticket.items.filter((item) => item.result === "WON").reduce((acc, item) => acc * Number(item.oddValue), 1)
    : Number(ticket.totalOdds);
  const potentialWin = status === "WON"
    ? BigInt(Math.floor(Number(ticket.stake) * effectiveOdds))
    : ticket.potentialWin;

  const threshold = await getSettingNumber(SETTING_KEYS.TPE_PAYOUT_APPROVAL_THRESHOLD_XAF);
  const requiresApproval = status === "WON" && Number(potentialWin) > threshold;

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: { status, settledAt: new Date(), requiresApproval, totalOdds: effectiveOdds, potentialWin },
  });

  return { ticketId: updated.id, status: updated.status, requiresApproval };
}

/** Encaissement — paie un ticket GAGNÉ/REMBOURSÉ au guichet, en espèces, sans toucher au crédit du TPE. */
export async function payTicket(code: string, tpeId: string, cashierId: string, payoutCode?: string) {
  const ticket = await prisma.ticket.findUnique({ where: { code: code.toUpperCase() } });
  if (!ticket) throw new AppError(404, "Code ticket introuvable");

  if (ticket.status === "PAID") throw new AppError(400, "Ce ticket a déjà été payé");
  if (ticket.status === "CANCELLED") throw new AppError(400, "Ce ticket a été annulé");
  if (ticket.status === "PENDING") throw new AppError(400, "Ce ticket n'est pas encore réglé");
  if (ticket.status === "LOST") throw new AppError(400, "Ce ticket est perdant — rien à payer");

  // Le code de validation n'est imprimé que sur le ticket ORIGINAL (jamais
  // sur une réimpression) — l'exiger ici empêche qu'une réimpression soit
  // présentée frauduleusement au paiement. Absent pour les tickets émis
  // avant l'introduction de ce contrôle (payoutCode null en base).
  if (ticket.payoutCode && ticket.payoutCode !== payoutCode) {
    throw new AppError(403, "Code de validation incorrect");
  }

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

  // Le paiement d'un ticket (gagnant ou remboursé) n'affecte plus le crédit
  // du TPE payeur (demande explicite du 30/10/2026) : seule la vente déduit
  // le crédit (voir placeTicket) — le paiement reste entièrement en espèces
  // au guichet, hors du solde de crédit, mais reste visible séparément sur
  // la caisse du jour (voir getCashierSummary, basé sur les tickets
  // paidAt/paidByTpeId, pas sur le crédit).
  //
  // La mise à jour du statut est conditionnée (WHERE status = <statut lu
  // ci-dessus>) plutôt qu'inconditionnelle : sans ça, deux paiements envoyés
  // presque simultanément pour le même ticket passent tous les deux les
  // vérifications ci-dessus (toutes deux lues avant que l'une des deux
  // n'ait validé le paiement), et marqueraient le ticket payé deux fois.
  // Seule la première des deux transactions à s'exécuter trouve encore le
  // statut attendu ; la seconde touche 0 ligne et échoue proprement.
  const paidAt = new Date();
  const result = await prisma.ticket.updateMany({
    where: { id: ticket.id, status: ticket.status },
    data: {
      status: "PAID",
      paidAt,
      paidByTpeId: tpeId,
      paidByCashierId: cashierId,
    },
  });
  if (result.count === 0) {
    throw new AppError(409, "Ce ticket vient d'être payé par une autre opération");
  }

  return {
    ticketId: ticket.id,
    code: ticket.code,
    amountPaidXAF: Number(amountToPay) / 100,
    paidAt,
    tpe: { code: payingTpe.code, name: payingTpe.name },
  };
}

/** Encaissement d'un cash-out accepté sur le site public (voir cashout.service.ts) — paie cashedOutAmount en espèces, sans toucher au crédit du TPE (même règle que payTicket). */
export async function payCashout(code: string, tpeId: string, cashierId: string, payoutCode?: string) {
  const ticket = await prisma.ticket.findUnique({ where: { code: code.toUpperCase() } });
  if (!ticket) throw new AppError(404, "Code ticket introuvable");

  if (ticket.status === "PAID") throw new AppError(400, "Ce cash-out a déjà été payé");
  if (ticket.status !== "CASHED_OUT_PENDING") {
    throw new AppError(400, "Ce ticket n'a pas de cash-out en attente de paiement");
  }
  if (ticket.payoutCode && ticket.payoutCode !== payoutCode) {
    throw new AppError(403, "Code de validation incorrect");
  }
  if (ticket.cashedOutAmount == null) {
    // Ne devrait jamais arriver (cashedOutAmount toujours posé en même
    // temps que le statut CASHED_OUT_PENDING, voir requestCashout) — garde
    // de cohérence plutôt qu'un payload silencieusement incorrect.
    throw new AppError(500, "Montant du cash-out manquant — contactez le backoffice");
  }

  const payingTpe = await prisma.tpe.findUnique({ where: { id: tpeId } });
  if (!payingTpe) throw new AppError(404, "TPE payeur introuvable");

  const paidAt = new Date();
  const result = await prisma.ticket.updateMany({
    where: { id: ticket.id, status: "CASHED_OUT_PENDING" },
    data: { status: "PAID", paidAt, paidByTpeId: tpeId, paidByCashierId: cashierId },
  });
  if (result.count === 0) {
    throw new AppError(409, "Ce cash-out vient d'être payé par une autre opération");
  }

  return {
    ticketId: ticket.id,
    code: ticket.code,
    amountPaidXAF: Number(ticket.cashedOutAmount) / 100,
    paidAt,
    tpe: { code: payingTpe.code, name: payingTpe.name },
  };
}

/** Accès exceptionnel réservé au backoffice (ex. premier ticket imprimé illisible/perdu, bourrage papier) — à utiliser avec parcimonie, ça contourne la protection anti-réimpression. */
export async function getTicketPayoutCode(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { payoutCode: true } });
  if (!ticket) throw new AppError(404, "Ticket introuvable");
  return { payoutCode: ticket.payoutCode };
}

/** Approuve un ticket gagnant dont le gain dépasse le seuil — débloque son paiement au guichet. */
export async function approveTicket(ticketId: string, approvedBy: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new AppError(404, "Ticket introuvable");
  if (ticket.status !== "WON") throw new AppError(400, "Seul un ticket gagnant peut être approuvé");
  if (ticket.approvedAt) throw new AppError(400, "Ce ticket est déjà approuvé");

  // approvedBy est obligatoire — un gros gain approuvé sans trace de qui l'a
  // approuvé rend ce contrôle inutile contre l'auto-approbation par un
  // compte qui aurait aussi créé/réglé/encaissé le même ticket.
  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: { approvedAt: new Date(), approvedBy },
  });
  return { ticketId: updated.id, approvedAt: updated.approvedAt };
}
