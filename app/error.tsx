"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Only in development is the real message available in the browser (production hides it). */
function isDbError(error: Error) {
  return (
    process.env.NODE_ENV !== "production" &&
    /Authentication failed against the database|Can't reach database server|P1000|P1001|ECONNREFUSED|database ".*" does not exist/i.test(error.message ?? "")
  );
}

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[70dvh] place-items-center px-4">
      <div className="card-surface max-w-md p-8 text-center">
        <p className="font-mono text-xs tracking-[0.3em] text-red-300 uppercase">Xatolik</p>
        <h1 className="mt-3 font-display text-2xl font-bold">Sahifani yuklab bo‘lmadi</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Kutilmagan xatolik yuz berdi. Qayta urinib ko‘ring; muammo takrorlansa, birozdan so‘ng qayta kiring.
        </p>
        {isDbError(error) && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/[0.06] p-3 text-left text-sm" data-testid="db-error-hint">
            <p className="font-semibold text-gold-soft">Ma’lumotlar bazasiga ulanib bo‘lmadi</p>
            <p className="mt-1 text-muted-foreground">
              Terminalda bajaring: <code className="font-mono text-foreground">npm run db:fix</code> — so‘ng sahifani yangilang.
            </p>
          </div>
        )}
        {error.digest && <p className="mt-3 font-mono text-[11px] text-muted-foreground/70">Kod: {error.digest}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>
            <RotateCcwIcon /> Qayta urinish
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Bosh sahifa</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
