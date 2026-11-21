import type { Metadata } from "next";
import { TrophyIcon } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { listChallenges } from "@/lib/data/challenges";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RiskDisclaimer } from "@/components/shared/risk-disclaimer";
import { ProAccessGate } from "@/components/subscription/pro-access-gate";
import { ChallengeCard } from "@/components/challenge/challenge-card";

export const metadata: Metadata = { title: "Challenge", description: "Ta’limiy challenge’lar: testlar, grafik tahlili, risk management va demo-jurnal topshiriqlari." };

export default async function ChallengeListPage() {
  const viewer = await getViewer();
  const items = await listChallenges(viewer?.id ?? null);
  const canParticipate = Boolean(viewer?.hasPremium);
  const groups = [
    { key: "OPEN", title: "Faol challenge’lar" },
    { key: "UPCOMING", title: "Tez orada" },
    { key: "RESULTS", title: "Natijalar e’lon qilingan" },
    { key: "ENDED", title: "Yakunlangan" },
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow="Challenge"
        title="Challenge tizimi"
        description="Bilim va tahliliy ko‘nikmalaringizni sinovdan o‘tkazing. Barcha challenge’lar ta’limiy: real pul kiritish yoki real savdo talab qilinmaydi."
      />
      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12 sm:px-6 lg:px-8">
        {!canParticipate && <ProAccessGate isGuest={!viewer} />}

        {items.length === 0 ? (
          <EmptyState icon={<TrophyIcon />} title="Hozircha challenge e’lon qilinmagan" description="Yangi challenge’lar e’lon qilinganda shu yerda ko‘rinadi." />
        ) : (
          groups.map((g) => {
            const list = items.filter((i) => i.phase === g.key);
            if (list.length === 0) return null;
            return (
              <section key={g.key} aria-labelledby={`grp-${g.key}`}>
                <h2 id={`grp-${g.key}`} className="font-display text-2xl font-bold">
                  {g.title}
                </h2>
                <ul className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {list.map((item) => (
                    <li key={item.id}>
                      <ChallengeCard item={item} linked={canParticipate} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
        <RiskDisclaimer>
          <strong className="font-semibold text-amber-200">Muhim.</strong> Challenge’lar faqat ta’lim maqsadida o‘tkaziladi: testlar, tahlil va demo-hisobdagi jurnal topshiriqlari. Qatnashish uchun real hisob ochish, depozit kiritish yoki leveraj bilan savdo qilish talab qilinmaydi. Mukofotlar faqat admin e’lon qilgan shartlar asosida beriladi va kafolatlanmaydi.
        </RiskDisclaimer>
      </div>
    </>
  );
}
