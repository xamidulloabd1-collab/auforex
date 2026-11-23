import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { MotionProvider } from "@/components/shared/motion-provider";
import { fontDisplay, fontMono, fontSans } from "./fonts";
import { publicSiteUrl } from "@/lib/site-url";
import "./globals.css";

const siteUrl = publicSiteUrl();

/**
 * Every page shows live data (settings, lessons, challenges) and the signed-in user, so pages are
 * rendered per request — never frozen at build time. This also lets the Docker build run
 * without a database (Railway builds have no database access).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AU Forex Academy — 0 dan natijagacha, birga!",
    template: "%s · AU Forex Academy",
  },
  description:
    "AU Forex Academy — tradingni noldan o‘rganish, moliyaviy bozorlarni tushunish, risklarni boshqarish va bilimlarni bosqichma-bosqich rivojlantirish uchun ta’lim platformasi.",
  applicationName: "AU Forex Platform",
  keywords: ["forex", "trading", "treyding", "ta’lim", "texnik tahlil", "risk management", "AU Forex Academy"],
  openGraph: {
    type: "website",
    locale: "uz_UZ",
    siteName: "AU Forex Academy",
    title: "AU Forex Academy — 0 dan natijagacha, birga!",
    description: "Tradingni noldan o‘rganish uchun premium ta’lim platformasi.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  appleWebApp: { capable: true, title: "AU Forex", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#080B12",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" data-scroll-behavior="smooth" className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh overflow-x-hidden">
        <MotionProvider>{children}</MotionProvider>
        <Toaster />
      </body>
    </html>
  );
}
