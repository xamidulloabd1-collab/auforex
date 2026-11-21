import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/shared/logo";

export default function NotFound() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div aria-hidden className="chart-grid pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative max-w-md text-center">
        <LogoMark className="mx-auto mb-8 size-12" />
        <p className="font-mono text-sm tracking-[0.3em] text-gold-soft">404</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold">Sahifa topilmadi</h1>
        <p className="mt-3 text-muted-foreground">Siz izlagan sahifa mavjud emas yoki ko‘chirilgan. Bosh sahifaga qaytib, kerakli bo‘limni tanlang.</p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/">
            <CompassIcon /> Bosh sahifaga qaytish
          </Link>
        </Button>
      </div>
    </main>
  );
}
