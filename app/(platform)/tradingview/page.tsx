import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getSetting } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { RiskDisclaimer } from "@/components/shared/risk-disclaimer";
import { ProAccessGate } from "@/components/subscription/pro-access-gate";
import { TradingViewChart } from "@/components/tradingview/tradingview-chart";

export const metadata: Metadata = { title: "TradingView", description: "Interaktiv moliyaviy grafiklar va asosiy bozor atamalari." };

const GLOSSARY = [
  { term: "Pip", text: "Valyuta juftligi narxining eng kichik standart o‘zgarishi (ko‘pchilik juftliklarda 0.0001)." },
  { term: "Lot", text: "Savdo hajmi birligi. Standart lot — bazaviy valyutaning 100 000 birligi." },
  { term: "Spred", text: "Bid (sotish) va Ask (sotib olish) narxlari orasidagi farq — savdo xarajatining bir qismi." },
  { term: "Leveraj", text: "Kichik marja bilan katta pozitsiya ochish imkoni. Foydani ham, zararni ham ko‘paytiradi." },
  { term: "Stop-loss", text: "Zarar belgilangan darajaga yetganda pozitsiyani avtomatik yopuvchi buyurtma." },
  { term: "Take-profit", text: "Narx maqsadli darajaga yetganda pozitsiyani yopib, natijani qayd etuvchi buyurtma." },
  { term: "Timeframe", text: "Har bir sham qamrab oladigan vaqt oralig‘i: 5m, 1H, 4H, 1D va hokazo." },
  { term: "Trend", text: "Narxning asosiy yo‘nalishi: ko‘tariluvchi, tushuvchi yoki yonlama (flet)." },
];

const SESSIONS = [
  { name: "Osiyo (Tokio)", time: "05:00 – 14:00" },
  { name: "Yevropa (London)", time: "13:00 – 22:00" },
  { name: "Amerika (Nyu-York)", time: "18:00 – 03:00" },
];

export default async function TradingViewPage() {
  const viewer = await requireUser("/tradingview");
  const access = await getSetting("access");
  const blocked = access.tradingviewRequiresPro && !viewer.hasPremium;

  return (
    <>
      <PageHeader
        eyebrow="TradingView"
        title="Interaktiv grafiklar"
        description="Instrument va timeframe’ni tanlang, chizish vositalari bilan tahlil qilishni mashq qiling. Bu sahifa ta’lim uchun — savdo buyurtmalari bu yerda bajarilmaydi."
      />
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        {blocked ? (
          <ProAccessGate />
        ) : (
          <>
            <TradingViewChart />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Grafik ma’lumotlari TradingView tomonidan taqdim etiladi. Ma’lumotlar provayder shartlariga ko‘ra kechikish bilan ko‘rsatilishi mumkin — real vaqt rejimi kafolatlanmaydi.
            </p>
          </>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="card-surface p-6 lg:col-span-2" aria-labelledby="glossary-title">
            <h2 id="glossary-title" className="font-display text-xl font-bold">
              Bozor atamalari
            </h2>
            <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              {GLOSSARY.map((g) => (
                <div key={g.term}>
                  <dt className="font-mono text-sm font-semibold text-gold-soft">{g.term}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{g.text}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="card-surface p-6" aria-labelledby="sessions-title">
            <h2 id="sessions-title" className="font-display text-xl font-bold">
              Savdo sessiyalari
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">Toshkent vaqti bo‘yicha taxminiy oraliqlar (mavsumga qarab ±1 soat).</p>
            <ul className="mt-5 grid gap-3">
              {SESSIONS.map((s) => (
                <li key={s.name} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                  <span>{s.name}</span>
                  <span className="font-mono text-muted-foreground">{s.time}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <RiskDisclaimer />
      </div>
    </>
  );
}
