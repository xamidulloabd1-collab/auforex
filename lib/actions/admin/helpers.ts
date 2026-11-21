import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getStorage } from "@/lib/storage";
import { areaOf, type StorageArea } from "@/lib/storage/keys";
import { slugify } from "@/lib/utils";
import { UserFacingError } from "../result";

type SlugModel = "course" | "lesson" | "book" | "challenge";

/** Returns a unique slug for the model, derived from the requested slug or title. */
export async function uniqueSlug(model: SlugModel, requested: string, title: string, excludeId?: string) {
  const base = slugify(requested || title) || `${model}-${Date.now().toString(36)}`;
  let candidate = base;
  for (let i = 2; i < 200; i++) {
    const where = { slug: candidate };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = await (prisma[model] as any).findUnique({ where, select: { id: true } });
    if (!found || found.id === excludeId) return candidate;
    candidate = `${base}-${i}`;
  }
  throw new UserFacingError("Slug yaratib bo‘lmadi");
}

/** Validates that an uploaded storage key belongs to the expected area and exists. */
export async function assertStoredKey(key: string | null | undefined, area: StorageArea) {
  if (!key) return null;
  if (areaOf(key) !== area) throw new UserFacingError("Fayl kaliti noto‘g‘ri");
  const info = await getStorage().stat(key);
  if (!info) throw new UserFacingError("Yuklangan fayl topilmadi — qayta yuklang");
  return info;
}

export function nullable(v: string | null | undefined) {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}
