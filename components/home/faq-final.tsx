import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/page-header";
import { Reveal } from "@/components/shared/reveal";
import { TelegramIcon } from "@/components/shared/brand-icons";
import { LogoMark } from "@/components/shared/logo";

export function Faq({ items }: { items: { question: string; answer: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section className="py-14 sm:py-20 md:py-28" aria-labelledby="faq-title">
      <div className="mx-auto grid grid-cols-1 max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-4">
          <SectionHeading eyebrow="Savol-javob" title={<span id="faq-title">Ko‘p beriladigan savollar</span>} />
        </div>
        <Reveal className="lg:col-span-8">
          <Accordion type="single" collapsible className="card-surface px-6 sm:px-8">
            {items.map((item, i) => (
              <AccordionItem key={item.question} value={`faq-${i}`}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

export function FinalCta({ slogan, primaryCta, primaryHref, telegramUrl }: { slogan: string; primaryCta: string; primaryHref: string; telegramUrl: string }) {
  return (
    <section className="pb-6" aria-labelledby="final-cta-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-border-strong bg-card px-6 py-14 text-center sm:px-12 md:py-20">
            <div aria-hidden className="chart-grid absolute inset-0 opacity-60" />
            <div aria-hidden className="absolute -bottom-32 left-1/2 h-64 w-[44rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative">
              <LogoMark className="mx-auto size-12" />
              <h2 id="final-cta-title" className="mx-auto mt-6 max-w-3xl font-display text-3xl font-extrabold sm:text-5xl">
                <span className="gold-text">{slogan}</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Birinchi qadamni bugun qo‘ying: hisob oching, darslarni ko‘ring va bilimingizni bosqichma-bosqich mustahkamlang.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="xl">
                  <Link href={primaryHref}>
                    {primaryCta} <ArrowRightIcon />
                  </Link>
                </Button>
                {telegramUrl && (
                  <Button asChild size="xl" variant="outline">
                    <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
                      <TelegramIcon className="size-4 text-[#2AABEE]" /> Telegram kanal
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
