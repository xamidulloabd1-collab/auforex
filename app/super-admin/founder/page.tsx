import { requireSuperAdmin } from "@/lib/auth/session";
import { getSetting } from "@/lib/settings";
import { publicMediaUrl } from "@/lib/storage/keys";
import { AdminTitle } from "@/components/admin/admin-title";
import { FounderForm } from "@/components/admin/settings-forms";

export default async function AdminFounderPage() {
  await requireSuperAdmin();
  const founder = await getSetting("founder");
  return (
    <>
      <AdminTitle title="Founder" description="Bo‘sh maydonlar saytda “hali kiritilmagan” deb belgilangan joy sifatida ko‘rinadi." />
      <FounderForm defaults={founder} portraitUrl={publicMediaUrl(founder.portraitKey)} />
    </>
  );
}
