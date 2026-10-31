import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import { serializeTicket } from "./tpe.service";
import { getCashoutQuote, requestCashout } from "./cashout.service";

const COUPON_TTL_MS = 24 * 60 * 60 * 1000; // 24h — à retirer en boutique avant expiration

// Code à 4 chiffres — simple à retenir et à communiquer oralement en
// boutique (même format que Ticket.payoutCode). Avec ~10 000 combinaisons,
// le code seul ne protège ni argent ni donnée personnelle (il ne révèle que
// des sélections de paris publiques) : au pire, quelqu'un qui devine le
// code d'un tiers pourrait faire valider ses sélections à sa place en
// boutique avant lui — pas de vol possible, juste une gêne. La boucle de
// régénération ci-dessous (createWebCoupon) absorbe les collisions sans
// erreur, même si elles deviennent plus fréquentes à fort volume.
function generateCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Les codes de ticket (voir tpe.service.generateTicketCode) gardent le
// format XXX-XXX-XXX, séparé du nouveau format coupon à 4 chiffres — la
// page de vérification publique invite maintenant juste à entrer "1234" en
// exemple, donc un bettor cherchant son TICKET peut taper son code sans les
// tirets en pensant que c'est optionnel. Reconstruit le format d'origine
// avant d'abandonner la recherche.
function reinsertTicketDashes(code: string): string | null {
  const stripped = code.replace(/-/g, "");
  if (!/^[A-Z0-9]{9}$/.test(stripped)) return null;
  return `${stripped.slice(0, 3)}-${stripped.slice(3, 6)}-${stripped.slice(6, 9)}`;
}

interface CouponSelection {
  eventId: string;
  eventLabel: string;
  marketId: string;
  marketName: string;
  oddId: string;
  oddLabel: string;
  oddValue: number;
}

/** Composé depuis le site public, sans compte — resalidé puis converti en Ticket en boutique (voir tpe.service.placeTicket). */
export async function createWebCoupon(selections: { oddId: string }[], stakeXAF?: number) {
  if (!selections?.length) throw new AppError(400, "Aucune sélection");
  if (selections.length > 15) throw new AppError(400, "Maximum 15 événements par coupon");

  // Mise suggérée optionnelle — simple pré-remplissage côté caissier,
  // revalidée (et modifiable) à la prise réelle du ticket (placeTicket),
  // donc une vérification sommaire suffit ici (même minimum que
  // placeTicket, pour éviter d'afficher une suggestion qui serait de toute
  // façon rejetée en boutique).
  let stake: bigint | undefined;
  if (stakeXAF !== undefined && stakeXAF !== null) {
    if (isNaN(Number(stakeXAF)) || Number(stakeXAF) < 100) {
      throw new AppError(400, "Mise suggérée invalide (minimum 100 XAF)");
    }
    stake = BigInt(Math.round(Number(stakeXAF) * 100));
  }

  const oddIds = selections.map((s) => s.oddId);
  const odds = await prisma.odd.findMany({
    where: { id: { in: oddIds }, isActive: true },
    include: { market: { include: { event: true } } },
  });
  if (odds.length !== selections.length) {
    throw new AppError(400, "Une ou plusieurs sélections sont invalides ou suspendues");
  }

  // Un seul pari par MARCHÉ (pas par match) sur un même coupon — plusieurs
  // marchés différents du même match peuvent cohabiter (ex. 1X2 + plus/moins
  // + BTTS), mais deux issues du même marché sont mutuellement exclusives
  // (demande explicite du 31/10/2026). Déjà appliqué côté site public
  // (coupon.store.ts), revalidé ici au cas où l'API serait appelée
  // directement sans passer par le store.
  const marketKeys = odds.map((o) => `${o.market.event.id}:${o.marketId}`);
  if (new Set(marketKeys).size !== marketKeys.length) {
    throw new AppError(400, "Une seule sélection par marché est autorisée sur un même coupon");
  }

  const snapshot: CouponSelection[] = [];
  for (const odd of odds) {
    if (odd.market.isSuspended) throw new AppError(400, `Marché suspendu : ${odd.market.name}`);
    if (odd.market.event.status !== "UPCOMING" && odd.market.event.status !== "LIVE") {
      throw new AppError(400, `Événement non disponible : ${odd.market.event.homeTeam} vs ${odd.market.event.awayTeam}`);
    }
    if (odd.market.event.status === "UPCOMING" && odd.market.event.startTime <= new Date()) {
      throw new AppError(400, `Ce match a déjà débuté : ${odd.market.event.homeTeam} vs ${odd.market.event.awayTeam}`);
    }
    snapshot.push({
      eventId: odd.market.event.id,
      eventLabel: `${odd.market.event.homeTeam} vs ${odd.market.event.awayTeam}`,
      marketId: odd.marketId,
      marketName: odd.market.name,
      oddId: odd.id,
      oddLabel: odd.label,
      oddValue: Number(odd.value),
    });
  }

  let code = generateCode();
  while (await prisma.webCoupon.findUnique({ where: { code } })) code = generateCode();

  const expiresAt = new Date(Date.now() + COUPON_TTL_MS);
  const coupon = await prisma.webCoupon.create({
    data: { code, selections: snapshot, expiresAt, stake },
  });

  return { code: coupon.code, selectionsCount: snapshot.length, expiresAt: coupon.expiresAt };
}

/**
 * Consultation publique — ne renvoie jamais payoutCode (serializeTicket
 * l'exclut déjà). Accepte aussi un code de ticket imprimé directement en
 * boutique (jamais passé par un coupon web).
 *
 * Usage multiple volontaire : un coupon reste valable (et réutilisable par
 * quiconque connaît le code, p. ex. des amis à qui il a été partagé)
 * jusqu'à expiration — il n'est jamais marqué "utilisé" après un premier
 * retrait. `tickets` liste donc tous les tickets déjà émis à partir de ce
 * code (peut être vide, un, ou plusieurs).
 */
const TICKET_INCLUDE = { items: { include: { market: { include: { event: true } }, odd: true } } };

/** Résout un code tapé par un parieur en Ticket — tolère l'absence des tirets (voir reinsertTicketDashes). */
async function resolveTicketByCode(cleanCode: string) {
  let ticket = await prisma.ticket.findUnique({ where: { code: cleanCode }, include: TICKET_INCLUDE });
  if (!ticket) {
    const dashed = reinsertTicketDashes(cleanCode);
    if (dashed && dashed !== cleanCode) {
      ticket = await prisma.ticket.findUnique({ where: { code: dashed }, include: TICKET_INCLUDE });
    }
  }
  return ticket;
}

export async function getWebCouponStatus(code: string) {
  const cleanCode = code.trim().toUpperCase();
  const coupon = await prisma.webCoupon.findUnique({
    where: { code: cleanCode },
    include: {
      tickets: {
        include: { items: { include: { market: { include: { event: true } }, odd: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!coupon) {
    const ticket = await resolveTicketByCode(cleanCode);
    if (!ticket) throw new AppError(404, "Code introuvable");
    // Le devis n'a de sens que pour un ticket encore en attente — inutile
    // (et potentiellement coûteux) de le recalculer pour un ticket déjà
    // réglé/payé.
    const cashoutQuote = ticket.status === "PENDING" ? await getCashoutQuote(ticket.id) : null;
    return { code: ticket.code, status: "USED" as const, ticket: { ...serializeTicket(ticket), cashoutQuote } };
  }

  if (coupon.status === "PENDING" && new Date() > coupon.expiresAt) {
    await prisma.webCoupon.update({ where: { id: coupon.id }, data: { status: "EXPIRED" } });
    coupon.status = "EXPIRED";
  }

  const tickets = await Promise.all(coupon.tickets.map(async (t) => ({
    ...serializeTicket(t),
    cashoutQuote: t.status === "PENDING" ? await getCashoutQuote(t.id) : null,
  })));

  return {
    code: coupon.code,
    status: coupon.status,
    selections: coupon.selections,
    expiresAt: coupon.expiresAt,
    tickets,
  };
}

/** Accepter l'offre de cash-out depuis le site public, par code de ticket + code de sécurité. */
export async function requestCashoutByCode(code: string, payoutCode?: string) {
  const ticket = await resolveTicketByCode(code.trim().toUpperCase());
  if (!ticket) throw new AppError(404, "Code introuvable");
  const result = await requestCashout(ticket.id, payoutCode);
  return result;
}

/** Caissier (TPE) — revalide les sélections contre les cotes actuelles avant de les proposer à l'écran de mise. Réutilisable jusqu'à expiration : pas de contrôle "déjà utilisé". */
export async function getWebCouponForCashier(code: string) {
  const coupon = await prisma.webCoupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon) throw new AppError(404, "Code coupon introuvable");
  if (coupon.status === "CANCELLED") throw new AppError(400, "Ce coupon a été annulé");
  if (coupon.status === "EXPIRED" || new Date() > coupon.expiresAt) {
    if (coupon.status !== "EXPIRED") {
      await prisma.webCoupon.update({ where: { id: coupon.id }, data: { status: "EXPIRED" } });
    }
    throw new AppError(400, "Ce coupon a expiré (valide 24h)");
  }

  const snapshot = coupon.selections as unknown as CouponSelection[];
  const oddIds = snapshot.map((s) => s.oddId);
  const odds = await prisma.odd.findMany({
    where: { id: { in: oddIds }, isActive: true },
    include: { market: { include: { event: true } } },
  });

  // Les cotes/évènements peuvent avoir changé depuis la composition — on ne
  // garde que ce qui est encore valable, le caissier (ou le client) décide
  // s'il complète/retire manuellement le reste en boutique.
  const valid: CouponSelection[] = [];
  let droppedCount = 0;
  for (const s of snapshot) {
    const odd = odds.find((o) => o.id === s.oddId);
    const stillOpen = odd && !odd.market.isSuspended &&
      (odd.market.event.status === "UPCOMING" || odd.market.event.status === "LIVE") &&
      !(odd.market.event.status === "UPCOMING" && odd.market.event.startTime <= new Date());
    if (odd && stillOpen) {
      valid.push({ ...s, oddValue: Number(odd.value) }); // cote à jour
    } else {
      droppedCount++;
    }
  }

  return {
    code: coupon.code,
    selections: valid,
    droppedCount,
    expiresAt: coupon.expiresAt,
    suggestedStakeXAF: coupon.stake != null ? Number(coupon.stake) / 100 : null,
  };
}
