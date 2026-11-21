import { getViewer } from "@/lib/auth/session";
import { getSetting } from "@/lib/settings";
import { getBookPreviews, getLessonPreviews, getPublicCounts } from "@/lib/data/learning";
import { publicMediaUrl } from "@/lib/storage/keys";
import { Hero } from "@/components/home/hero";
import { Welcome } from "@/components/home/welcome";
import { Advantages } from "@/components/home/advantages";
import { Roadmap } from "@/components/home/roadmap";
import { BooksPreview, LessonsPreview } from "@/components/home/previews";
import { ChallengeIntro, FounderPreview, ProBenefits, TradingViewIntro } from "@/components/home/feature-sections";
import { Faq, FinalCta } from "@/components/home/faq-final";

export default async function HomePage() {
  const [viewer, academy, home, faq, subscription, founder, counts, lessons, books] = await Promise.all([
    getViewer(),
    getSetting("academy"),
    getSetting("home"),
    getSetting("faq"),
    getSetting("subscription"),
    getSetting("founder"),
    getPublicCounts(),
    getLessonPreviews(6),
    getBookPreviews(3),
  ]);

  const primaryHref = viewer ? "/lessons" : "/register";

  return (
    <>
      <Hero
        title={home.heroTitle}
        slogan={home.heroSlogan}
        description={home.heroDescription}
        primaryCta={home.primaryCta}
        secondaryCta={home.secondaryCta}
        primaryHref={primaryHref}
        counts={counts}
      />
      <Welcome title={home.welcomeTitle} text={home.welcomeText} signature={founder.name || null} />
      <Advantages
        lessons={{ title: home.lessonsHeadline, description: home.lessonsDescription, liveLabel: `Hozir joylangan: ${counts.lessons} ta dars` }}
        library={{ title: home.libraryHeadline, description: home.libraryDescription, liveLabel: `Kutubxonada: ${counts.books} ta kitob` }}
        challenge={{ title: home.challengeHeadline, description: home.challengeDescription, liveLabel: `Faol challenge’lar: ${counts.challenges} ta` }}
      />
      <Roadmap />
      <LessonsPreview lessons={lessons} hasPremium={Boolean(viewer?.hasPremium)} />
      <BooksPreview books={books} />
      <TradingViewIntro />
      <ChallengeIntro activeCount={counts.challenges} />
      <ProBenefits
        headline={subscription.headline}
        benefits={subscription.benefits}
        comingSoon={subscription.contactNote}
        price={{ price: subscription.price, oldPrice: subscription.oldPrice, currency: subscription.currency, period: subscription.period }}
      />
      <FounderPreview name={founder.name} role={founder.role} message={founder.message} portraitUrl={publicMediaUrl(founder.portraitKey)} />
      <Faq items={faq.items} />
      <FinalCta slogan={academy.slogan} primaryCta={home.primaryCta} primaryHref={primaryHref} telegramUrl={academy.telegramUrl} />
    </>
  );
}
