import type { Metadata } from "next";
import Image from "next/image";
import { CompassIcon, GlobeIcon, MessageSquareQuoteIcon, PenLineIcon, TargetIcon, UserRoundIcon } from "lucide-react";
import { getSetting } from "@/lib/settings";
import { getViewer } from "@/lib/auth/session";
import { publicMediaUrl } from "@/lib/storage/keys";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/shared/page-header";
import { Reveal } from "@/components/shared/reveal";
import { InstagramIcon, TelegramIcon, YoutubeIcon } from "@/components/shared/brand-icons";

export const metadata: Metadata = {
  title: "Founder",
  description: "AU Forex Academy asoschisi, akademiya missiyasi va ta’lim falsafasi.",
};

function Placeholder({ label, show }: { label: string; show: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface/60 px-3 py-2 text-sm text-muted-foreground">
      <PenLineIcon className="size-3.5 text-gold-soft" />
      {label}
      {show && <span className="font-mono text-[10px] tracking-wider text-gold-soft/80 uppercase">· Admin → Founder</span>}
    </span>
  );
}

export default async function FounderPage() {
  const [founder, academy, viewer] = await Promise.all([getSetting("founder"), getSetting("academy"), getViewer()]);
  const isAdmin = Boolean(viewer?.isAdmin);
  const portrait = publicMediaUrl(founder.portraitKey);
  const socials = [
    { href: founder.socials.telegram || academy.telegramUrl, label: "Telegram", icon: TelegramIcon },
    { href: founder.socials.instagram, label: "Instagram", icon: InstagramIcon },
    { href: founder.socials.youtube, label: "YouTube", icon: YoutubeIcon },
    { href: founder.socials.website, label: "Veb-sayt", icon: GlobeIcon },
  ].filter((s) => s.href);

  // Empty blocks are shown as labelled placeholders to admins only.
  const blocks = [
    { icon: TargetIcon, title: "Akademiya missiyasi", text: founder.mission, placeholder: "Missiya matni hali kiritilmagan" },
    { icon: CompassIcon, title: "Ta’lim falsafasi", text: founder.philosophy, placeholder: "Ta’lim falsafasi hali kiritilmagan" },
  ].filter((b) => b.text || isAdmin);

  return (
    <div className="relative">
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="chart-grid absolute inset-0 opacity-60" />
        <div className="relative mx-auto grid grid-cols-1 max-w-7xl gap-12 px-4 py-14 sm:px-6 md:grid-cols-[minmax(0,380px)_1fr] md:items-center md:py-20 lg:px-8">
          <Reveal>
            <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[2rem] border border-border-strong bg-card">
              {portrait ? (
                <Image src={portrait} alt={founder.name || "Founder portreti"} fill priority sizes="(max-width: 768px) 90vw, 380px" className="object-cover" />
              ) : (
                <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_50%_30%,#1A2436,#0C111B)]">
                  <div className="text-center">
                    <UserRoundIcon className="mx-auto size-24 text-border-strong" strokeWidth={1} />
                    <p className="mt-4 text-sm text-muted-foreground">Portret yuklanmagan</p>
                  </div>
                </div>
              )}
              <div aria-hidden className="hairline-top absolute inset-x-0 top-0 h-px" />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <Eyebrow>Founder</Eyebrow>
            {founder.name ? (
              <h1 className="mt-4 font-display text-4xl font-extrabold sm:text-5xl">{founder.name}</h1>
            ) : (
              <div className="mt-4">
                <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Akademiya asoschisi</h1>
                <div className="mt-4">
                  <Placeholder label="Founder ismi hali kiritilmagan" show={isAdmin} />
                </div>
              </div>
            )}
            {founder.role && <p className="mt-3 text-lg text-gold-soft">{founder.role}</p>}
            <div className="mt-6 max-w-2xl text-[15.5px] leading-[1.8] text-muted-foreground">
              {founder.bio ? (
                founder.bio.split(/\n\s*\n/).map((p) => (
                  <p key={p.slice(0, 24)} className="mt-3 first:mt-0">
                    {p}
                  </p>
                ))
              ) : (
                <Placeholder label="Biografiya hali kiritilmagan" show={isAdmin} />
              )}
            </div>
            {socials.length > 0 && (
              <ul className="mt-8 flex flex-wrap gap-2">
                {socials.map(({ href, label, icon: Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-card px-4 py-2.5 text-sm font-medium transition hover:border-primary/50 hover:text-gold-soft"
                    >
                      <Icon className="size-4" /> {label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        </div>
      </section>

      <section className={`mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 py-16 sm:px-6 lg:px-8 ${blocks.length > 1 ? "md:grid-cols-2" : ""}`}>
        {blocks.map(({ icon: Icon, title, text, placeholder }) => (
          <Reveal key={title}>
            <article className="card-surface h-full p-7">
              <Icon className="size-6 text-gold-soft" />
              <h2 className="mt-5 font-display text-xl font-bold">{title}</h2>
              <div className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                {text ? <p className="whitespace-pre-line">{text}</p> : <Placeholder label={placeholder} show={isAdmin} />}
              </div>
            </article>
          </Reveal>
        ))}
      </section>

      {(founder.message || isAdmin) && (
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <figure className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-[radial-gradient(80%_120%_at_0%_0%,rgb(201_164_92/0.12),transparent_60%),#121A27] p-8 sm:p-12">
            <MessageSquareQuoteIcon className="size-8 text-gold-soft" />
            <Badge variant="outline" className="mt-5">
              Founder xabari
            </Badge>
            {founder.message ? (
              <blockquote className="mt-4 max-w-3xl font-display text-xl leading-relaxed font-semibold sm:text-2xl">{founder.message}</blockquote>
            ) : (
              <div className="mt-4">
                <Placeholder label="Founder xabari hali kiritilmagan" show={isAdmin} />
              </div>
            )}
            <figcaption className="mt-6 font-display font-bold">
              <span className="gold-text">{academy.slogan}</span>
            </figcaption>
          </figure>
        </Reveal>
      </section>
      )}
    </div>
  );
}
