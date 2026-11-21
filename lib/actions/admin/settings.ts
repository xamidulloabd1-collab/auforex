"use server";

import { revalidatePath } from "next/cache";
import { assertSuperAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { saveSetting } from "@/lib/settings";
import { SETTINGS_SCHEMAS, type SettingsKey, type SettingsValue } from "@/lib/settings/schema";
import { getStorage } from "@/lib/storage";
import { areaOf } from "@/lib/storage/keys";
import { actionError, UserFacingError, type ActionResult } from "../result";

const EDITABLE: SettingsKey[] = ["academy", "home", "faq", "footer", "subscription", "founder", "access"];

export async function updateSettings<K extends SettingsKey>(key: K, value: SettingsValue<K>): Promise<ActionResult> {
  try {
    // Site-level settings and the founder profile belong to the super admin.
    const admin = await assertSuperAdmin();
    if (!EDITABLE.includes(key)) throw new UserFacingError("Noma’lum sozlama");
    const parsed = SETTINGS_SCHEMAS[key].parse(value) as SettingsValue<K>;
    if (key === "founder") {
      const portraitKey = (parsed as SettingsValue<"founder">).portraitKey;
      if (portraitKey) {
        if (areaOf(portraitKey) !== "founder" || !(await getStorage().stat(portraitKey))) {
          throw new UserFacingError("Portret fayli topilmadi — qayta yuklang");
        }
      }
    }
    await saveSetting(key, parsed, admin.id);
    await audit({
      actorId: admin.id,
      action: key === "founder" ? "founder.update" : "settings.update",
      targetType: "SiteSetting",
      targetId: key,
      summary: `Sozlama: ${key}`,
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Saqlandi" };
  } catch (err) {
    return actionError(err);
  }
}
