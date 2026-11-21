import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_SETTINGS, SETTINGS_SCHEMAS, type SettingsKey, type SettingsValue } from "./schema";

/**
 * Reads a settings document, merged over defaults and validated.
 * Invalid or missing documents fall back to defaults (the site never breaks on bad data).
 */
export const getSetting = cache(async <K extends SettingsKey>(key: K): Promise<SettingsValue<K>> => {
  const fallback = DEFAULT_SETTINGS[key];
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key } });
    if (!row) return fallback;
    const merged = { ...fallback, ...(row.value as object) };
    const parsed = SETTINGS_SCHEMAS[key].safeParse(merged);
    return (parsed.success ? parsed.data : fallback) as SettingsValue<K>;
  } catch (err) {
    console.error(`[settings] failed to read "${key}"`, err);
    return fallback;
  }
});

export async function saveSetting<K extends SettingsKey>(key: K, value: SettingsValue<K>, actorId: string) {
  const parsed = SETTINGS_SCHEMAS[key].parse(value);
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value: parsed as object, updatedById: actorId },
    create: { key, value: parsed as object, updatedById: actorId },
  });
}
