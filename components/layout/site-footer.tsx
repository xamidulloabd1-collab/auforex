import Link from "next/link";
import { getSetting } from "@/lib/settings";
import { MAIN_NAV } from "@/lib/constants";
import { Logo } from "@/components/shared/logo";
import { TelegramIcon } from "@/components/shared/brand-icons";

export async function SiteFooter() {
  const [academy, footer] = await Promise.all([getSetting("academy"), getSetting("footer")]);
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-16 border-t sm:mt-24 border-border bg-surface/50">
      <div aria-hidden className="hairline-top absolute inset-x-0 top-0 h-px" />
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 sm:py-14 md:grid-cols-12 md:gap-12 lg:px-8">
        <div className="col-span-2 md:col-span-5">
          <Logo />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">{footer.about}</p>
          <p className="mt-4 font-display text-sm font-semibold text-gold-soft">{academy.slogan}</p>
          {academy.telegramUrl && (
            <a
              href={academy.telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border-strong bg-card px-4 py-2.5 text-sm font-medium transition hover:border-primary/50 hover:text-gold-soft"
            >
              <TelegramIcon className="size-4 text-[#2AABEE]" /> Telegram kanal
            </a>
          )}
        </div>

        <nav aria-label="Footer: bo‘limlar" className="min-w-0 md:col-span-3">
          <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Bo‘limlar</p>
          <ul className="mt-3 grid gap-0.5 text-sm sm:mt-4 sm:gap-1">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="inline-flex min-h-10 items-center text-foreground/80 transition hover:text-gold-soft sm:min-h-8">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Footer: foydali havolalar" className="min-w-0 md:col-span-4">
          <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Foydali havolalar</p>
          <ul className="mt-3 grid gap-0.5 text-sm sm:mt-4 sm:gap-1">
            {footer.links.map((l) => (
              <li key={`${l.href}-${l.label}`}>
                {l.href.startsWith("/") ? (
                  <Link href={l.href} className="inline-flex min-h-10 items-center text-foreground/80 transition hover:text-gold-soft sm:min-h-8">
                    {l.label}
                  </Link>
                ) : (
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-foreground/80 transition hover:text-gold-soft sm:min-h-8">
                    {l.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-xs leading-relaxed text-muted-foreground/90" data-testid="footer-disclaimer">
            {footer.disclaimer}
          </p>
          <p className="mt-4 font-mono text-[11px] tracking-wider text-muted-foreground/70">
            © {year} {academy.name}. Barcha huquqlar himoyalangan.
          </p>
        </div>
      </div>
    </footer>
  );
}
