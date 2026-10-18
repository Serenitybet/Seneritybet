import { prisma } from "./prisma";

export const SETTING_KEYS = {
  TPE_PAYOUT_APPROVAL_THRESHOLD_XAF: "TPE_PAYOUT_APPROVAL_THRESHOLD_XAF",
} as const;

const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.TPE_PAYOUT_APPROVAL_THRESHOLD_XAF]: "5000000", // 50 000 XAF (centimes)
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
