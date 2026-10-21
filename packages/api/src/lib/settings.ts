import { prisma } from "./prisma";

export const SETTING_KEYS = {
  TPE_PAYOUT_APPROVAL_THRESHOLD_XAF: "TPE_PAYOUT_APPROVAL_THRESHOLD_XAF",
  // Plafond de gain potentiel autorisé à la prise du pari (gestion de
  // risque) — voir tpe.service.ts placeTicket. 0 = désactivé (aucun
  // plafond), pour ne pas bloquer de tickets tant qu'un admin n'a pas
  // explicitement choisi une valeur dans le backoffice.
  TPE_MAX_WIN_XAF: "TPE_MAX_WIN_XAF",
} as const;

const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.TPE_PAYOUT_APPROVAL_THRESHOLD_XAF]: "5000000", // 50 000 XAF (centimes)
  [SETTING_KEYS.TPE_MAX_WIN_XAF]: "0", // désactivé par défaut (centimes)
};

export async function getSetting(key: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? DEFAULTS[key] ?? "";
}

export async function getSettingNumber(key: string): Promise<number> {
  return parseInt(await getSetting(key), 10);
}

export async function setSetting(key: string, value: string, updatedBy: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value, updatedBy },
    update: { value, updatedBy },
  });
}
