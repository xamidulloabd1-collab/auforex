import { requireAdmin } from "@/lib/auth/session";
import { AdminTitle } from "@/components/admin/admin-title";
import { ChallengeForm } from "@/components/admin/challenge-form";

export default async function NewChallengePage() {
  await requireAdmin();
  return (
    <>
      <AdminTitle title="Yangi challenge" description="Challenge qoralama sifatida yaratiladi. Savollar va mukofotlarni qo‘shgach, e’lon qiling." />
      <ChallengeForm />
    </>
  );
}
