import { prisma } from '@/lib/prisma';
import {
  SETTINGS_DEFAULTS,
  SETTINGS_META,
  splitList,
  type SettingKey,
  type ShopSettings,
} from '@/lib/settings-schema';

/**
 * Acces base de donnees aux parametres de l'etablissement.
 * Les definitions (cles, libelles, valeurs par defaut) vivent dans
 * settings-schema.ts pour rester importables cote client.
 */

export { SETTINGS_DEFAULTS, SETTINGS_META, splitList };
export type { SettingKey, ShopSettings };

/** Charge tous les parametres, en completant avec les valeurs par defaut. */
export async function getSettings(): Promise<ShopSettings> {
  let rows: { key: string; value: string }[] = [];
  try {
    rows = await prisma.setting.findMany({ select: { key: true, value: true } });
  } catch {
    rows = [];
  }
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const result = { ...SETTINGS_DEFAULTS } as Record<string, string>;
  for (const key of Object.keys(SETTINGS_DEFAULTS)) {
    const value = stored.get(key);
    if (value !== undefined && value !== null) result[key] = value;
  }
  return result as ShopSettings;
}

export async function getSetting(key: SettingKey): Promise<string> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value ?? SETTINGS_DEFAULTS[key];
  } catch {
    return SETTINGS_DEFAULTS[key];
  }
}
