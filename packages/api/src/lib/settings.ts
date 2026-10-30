import { prisma } from "./prisma";

export const SETTING_KEYS = {
  TPE_PAYOUT_APPROVAL_THRESHOLD_XAF: "TPE_PAYOUT_APPROVAL_THRESHOLD_XAF",
  // Plafond de gain potentiel autorisé à la prise du pari (gestion de
  // risque) — voir tpe.service.ts placeTicket. 0 = désactivé (aucun
  // plafond), pour ne pas bloquer de tickets tant qu'un admin n'a pas
  // explicitement choisi une valeur dans le backoffice.
  TPE_MAX_WIN_XAF: "TPE_MAX_WIN_XAF",
  // Cash-out (voir cashout.service.ts) — % de marge retenue sur la valeur
  // juste calculée (entier, ex. "20" = on verse 80% de la valeur juste), et
  // cote maximum acceptée pour une sélection pas encore jouée d'un ticket
  // (au-delà, trop incertain/outsider pour être intéressant à racheter —
  // décimal, voir getSettingFloat).
  CASHOUT_MARGIN_PCT: "CASHOUT_MARGIN_PCT",
  CASHOUT_MAX_ODD_PENDING: "CASHOUT_MAX_ODD_PENDING",
  // Nombre maximum de sélections encore non jouées tolérées pour qu'un
  // ticket reste éligible au cash-out (demande explicite) — un combiné où
  // presque rien n'a encore été joué est trop spéculatif pour être
  // intéressant à racheter, même si chaque sélection prise individuellement
  // est un favori.
  CASHOUT_MAX_PENDING_LEGS: "CASHOUT_MAX_PENDING_LEGS",
} as const;

const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.TPE_PAYOUT_APPROVAL_THRESHOLD_XAF]: "5000000", // 50 000 XAF (centimes)
  [SETTING_KEYS.TPE_MAX_WIN_XAF]: "0", // désactivé par défaut (centimes)
  [SETTING_KEYS.CASHOUT_MARGIN_PCT]: "20",
  [SETTING_KEYS.CASHOUT_MAX_ODD_PENDING]: "1.80",
  [SETTING_KEYS.CASHOUT_MAX_PENDING_LEGS]: "2",
};

export async function getSetting(key: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? DEFAULTS[key] ?? "";
}

export async function getSettingNumber(key: string): Promise<number> {
  return parseInt(await getSetting(key), 10);
}

export async function getSettingFloat(key: string): Promise<number> {
  return parseFloat(await getSetting(key));
}

export async function setSetting(key: string, value: string, updatedBy: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value, updatedBy },
    update: { value, updatedBy },
  });
}
