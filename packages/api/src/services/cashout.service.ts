import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import { getSettingFloat, SETTING_KEYS } from "../lib/settings";

export interface CashoutQuote {
  eligible: boolean;
  reason?: string;
  fairValueXAF?: number;
  offerXAF?: number;
  marginPct?: number;
}

/**
 * Calcule l'offre de cash-out d'un ticket à l'instant présent — toujours
 * recalculée à la demande (jamais mise en cache), le résultat n'a de sens
 * qu'au moment où on le lit.
 *
 * Éligible seulement si :
 * - le ticket est encore PENDING (pas déjà réglé/payé/annulé) ;
 * - aucune sélection n'est déjà PERDUE (ticket de toute façon condamné,
 *   rien à racheter) ;
 * - aucune sélection non jouée ne porte sur un match actuellement EN DIRECT
 *   (la synchro des cotes se suspend au coup d'envoi — voir markLiveEvents,
 *   odds.service.ts — donc aucune cote fraîche n'existe pour repricer un
 *   match en cours, impossible de calculer une valeur fiable) ;
 * - chaque sélection non jouée porte sur un match pas encore commencé
 *   (UPCOMING strict — un match FINISHED dont le résultat n'est pas encore
 *   saisi manuellement est logiquement aussi "pas pricable") ;
 * - chaque sélection non jouée a une cote actuelle <= seuil configuré
 *   (CASHOUT_MAX_ODD_PENDING) — trop d'incertitude sur un outsider pour que
 *   le rachat soit intéressant pour l'établissement (demande explicite).
 *
 * Valeur juste = mise × (cotes verrouillées des sélections déjà GAGNÉES) ×
 * (cotes ACTUELLES des sélections pas encore jouées — pas la cote figée à
 * l'achat, pour refléter un éventuel mouvement de cote avant coup d'envoi).
 * Les sélections VOID ne comptent pas (facteur neutre, comme à l'achat).
 * L'offre versée = valeur juste × (1 - marge configurée).
 */
export async function getCashoutQuote(ticketId: string): Promise<CashoutQuote> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { items: { include: { market: { include: { event: true } }, odd: true } } },
  });
  if (!ticket) throw new AppError(404, "Ticket introuvable");

  if (ticket.status !== "PENDING") {
    return { eligible: false, reason: "Ce ticket n'est pas (ou plus) en attente de règlement" };
  }

  if (ticket.items.some((i) => i.result === "LOST")) {
    return { eligible: false, reason: "Ce ticket contient déjà une sélection perdante" };
  }

  const pendingItems = ticket.items.filter((i) => i.result === null);

  if (pendingItems.some((i) => i.market.event.status === "LIVE")) {
    return { eligible: false, reason: "Cash-out indisponible : un match de ce ticket est actuellement en direct" };
  }
  if (pendingItems.some((i) => i.market.event.status !== "UPCOMING")) {
    return { eligible: false, reason: "Cash-out indisponible pour ce ticket actuellement" };
  }

  const [marginPct, maxOddPending] = await Promise.all([
    getSettingFloat(SETTING_KEYS.CASHOUT_MARGIN_PCT),
    getSettingFloat(SETTING_KEYS.CASHOUT_MAX_ODD_PENDING),
  ]);

  const tooRisky = pendingItems.find((i) => Number(i.odd.value) > maxOddPending);
  if (tooRisky) {
    return { eligible: false, reason: "Cash-out indisponible : une sélection à venir de ce ticket est trop incertaine" };
  }

  const decidedFactor = ticket.items
    .filter((i) => i.result === "WON")
    .reduce((acc, i) => acc * Number(i.oddValue), 1);
  const pendingFactor = pendingItems.reduce((acc, i) => acc * Number(i.odd.value), 1);

  const fairValueCents = Math.round(Number(ticket.stake) * decidedFactor * pendingFactor);
  const offerCents = Math.round(fairValueCents * (1 - marginPct / 100));

  return {
    eligible: true,
    fairValueXAF: fairValueCents / 100,
    offerXAF: offerCents / 100,
    marginPct,
  };
}

/**
 * Figer le cash-out — le joueur accepte l'offre affichée. Le devis est
 * toujours RECALCULÉ ici (jamais celui envoyé par le client) pour éviter
 * qu'un montant périmé ou manipulé soit accepté.
 */
export async function requestCashout(ticketId: string, payoutCode?: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new AppError(404, "Ticket introuvable");

  // Même protection anti-fraude que le paiement normal (voir payTicket) :
  // le code de validation n'est imprimé que sur l'original.
  if (ticket.payoutCode && ticket.payoutCode !== payoutCode) {
    throw new AppError(403, "Code de validation incorrect");
  }

  const quote = await getCashoutQuote(ticketId);
  if (!quote.eligible || quote.offerXAF === undefined) {
    throw new AppError(400, quote.reason ?? "Ce ticket n'est pas éligible au cash-out");
  }

  const cashedOutAmount = BigInt(Math.round(quote.offerXAF * 100));
  const cashedOutAt = new Date();

  // Conditionné (WHERE status = PENDING) : si le ticket a changé de statut
  // entre le calcul du devis ci-dessus et cette écriture (ex. une sélection
  // vient d'être réglée PERDUE par un autre flux), la mise à jour touche 0
  // ligne plutôt que de figer un cash-out sur un ticket déjà invalidé.
  const result = await prisma.ticket.updateMany({
    where: { id: ticketId, status: "PENDING" },
    data: { status: "CASHED_OUT_PENDING", cashedOutAmount, cashedOutAt },
  });
  if (result.count === 0) {
    throw new AppError(409, "Ce ticket a changé de statut entre-temps — rechargez la page");
  }

  return { ticketId, cashedOutAmountXAF: Number(cashedOutAmount) / 100, cashedOutAt };
}
