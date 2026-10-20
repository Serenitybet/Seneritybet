import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import { serializeTicket } from "./tpe.service";

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
export async function createWebCoupon(selections: { oddId: string }[]) {
  if (!selections?.length) throw new AppError(400, "Aucune sélection");
  if (selections.length > 15) throw new AppError(400, "Maximum 15 événements par coupon");

  const oddIds = selections.map((s) => s.oddId);
  const odds = await prisma.odd.findMany({
    where: { id: { in: oddIds }, isActive: true },
    include: { market: { include: { event: true } } },
  });
  if (odds.length !== selections.length) {
    throw new AppError(400, "Une ou plusieurs sélections sont invalides ou suspendues");
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
    data: { code, selections: snapshot, expiresAt },
  });

  return { code: coupon.code, selectionsCount: snapshot.length, expiresAt: coupon.expiresAt };
}

/** Consultation publique — ne renvoie jamais payoutCode (serializeTicket l'exclut déjà). Accepte aussi un code de ticket imprimé directement en boutique (jamais passé par un coupon web). */
export async function getWebCouponStatus(code: string) {
  const cleanCode = code.trim().toUpperCase();
  const coupon = await prisma.webCoupon.findUnique({
    where: { code: cleanCode },
    include: { ticket: { include: { items: { include: { market: { include: { event: true } }, odd: true } } } } },
  });

  if (!coupon) {
    const ticket = await prisma.ticket.findUnique({
      where: { code: cleanCode },
      include: { items: { include: { market: { include: { event: true } }, odd: true } } },
    });
    if (!ticket) throw new AppError(404, "Code introuvable");
    return { code: ticket.code, status: "USED" as const, ticket: serializeTicket(ticket) };
  }

  if (coupon.status === "PENDING" && new Date() > coupon.expiresAt) {
    await prisma.webCoupon.update({ where: { id: coupon.id }, data: { status: "EXPIRED" } });
    coupon.status = "EXPIRED";
  }

  if (coupon.status === "USED" && coupon.ticket) {
    return { code: coupon.code, status: "USED" as const, ticket: serializeTicket(coupon.ticket) };
  }

  return {
    code: coupon.code,
    status: coupon.status,
    selections: coupon.selections,
    expiresAt: coupon.expiresAt,
  };
}

/** Caissier (TPE) — revalide les sélections contre les cotes actuelles avant de les proposer à l'écran de mise. */
export async function getWebCouponForCashier(code: string) {
  const coupon = await prisma.webCoupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon) throw new AppError(404, "Code coupon introuvable");
  if (coupon.status === "USED") throw new AppError(400, "Ce coupon a déjà été retiré en boutique");
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

  return { code: coupon.code, selections: valid, droppedCount, expiresAt: coupon.expiresAt };
}
