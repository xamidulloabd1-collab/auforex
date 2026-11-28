"use client";

import * as React from "react";
import { ExternalLinkIcon, RefreshCwIcon, WifiOffIcon } from "lucide-react";
import { useChartPreferences } from "@/hooks/use-chart-preferences";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const INSTRUMENTS = [
  { symbol: "FX:EURUSD", label: "EUR/USD" },
  { symbol: "FX:GBPUSD", label: "GBP/USD" },
  { symbol: "FX:USDJPY", label: "USD/JPY" },
  { symbol: "FX:AUDUSD", label: "AUD/USD" },
  { symbol: "OANDA:XAUUSD", label: "XAU/USD (Oltin)" },
  { symbol: "OANDA:US30USD", label: "US30" },
  { symbol: "BITSTAMP:BTCUSD", label: "BTC/USD" },
] as const;

export const INTERVALS = [
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "60", label: "1H" },
  { value: "240", label: "4H" },
  { value: "D", label: "1D" },
  { value: "W", label: "1W" },
] as const;

const LOAD_TIMEOUT_MS = 12_000;

type Status = "loading" | "ready" | "error";

export function TradingViewChart() {
  const prefs = useChartPreferences();
  // Persisted preferences exist only in the browser: render defaults until hydrated.
  const hydrated = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const symbol = hydrated ? prefs.symbol : "FX:EURUSD";
  const interval = hydrated ? prefs.interval : "60";
  const { setSymbol, setInterval } = prefs;
  const [attempt, setAttempt] = React.useState(0);
  const [loadedKey, setLoadedKey] = React.useState<string | null>(null);
  const [failedKey, setFailedKey] = React.useState<string | null>(null);
  const embedUrl = React.useMemo(() => {
    const params = new URLSearchParams({
      frameElementId: "tradingview_advanced_chart",
      symbol,
      interval,
      timezone: "Asia/Tashkent",
      theme: "dark",
      style: "1",
      locale: "en",
      hidesidetoolbar: "0",
      symboledit: "1",
      saveimage: "0",
      hideideas: "1",
    });
    return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
  }, [symbol, interval]);

  const instanceKey = `${embedUrl}:${attempt}`;
  const status: Status = loadedKey === instanceKey ? "ready" : failedKey === instanceKey ? "error" : "loading";

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setFailedKey(instanceKey);
    }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [instanceKey]);

  const current = INSTRUMENTS.find((i) => i.symbol === symbol);
  const externalUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;

  return (
    <div className="card-surface overflow-hidden" data-testid="tradingview-panel">
      <div className="flex flex-col gap-3 border-b border-border p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="radiogroup" aria-label="Instrument" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:pb-0">
          {INSTRUMENTS.map((i) => {
            const active = i.symbol === symbol;
            return (
              <button
                key={i.symbol}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSymbol(i.symbol)}
                className={cn(
                  "shrink-0 rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold whitespace-nowrap transition-colors",
                  active ? "border-primary/50 bg-primary/10 text-gold-soft" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                {i.label}
              </button>
            );
          })}
        </div>
        <div role="radiogroup" aria-label="Timeframe" className="flex gap-1 rounded-xl border border-border bg-surface p-1">
          {INTERVALS.map((t) => {
            const active = t.value === interval;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setInterval(t.value)}
                className={cn(
                  "min-w-10 rounded-lg px-2 py-1 font-mono text-xs transition-colors",
                  active ? "bg-card-elevated text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative h-[62vh] min-h-[380px] bg-[#0C111B] md:h-[640px]">
        <iframe
          key={instanceKey}
          id="tradingview_advanced_chart"
          src={embedUrl}
          title={`TradingView ${current?.label ?? "chart"}`}
          className="absolute inset-0 size-full border-0"
          loading="lazy"
          allow="autoplay; fullscreen"
          allowFullScreen
          onLoad={() => setLoadedKey(instanceKey)}
          onError={() => setFailedKey(instanceKey)}
        />
        {status === "loading" && (
          <div className="pointer-events-none absolute inset-0 grid gap-3 p-6" aria-live="polite">
            <span className="sr-only">Grafik yuklanmoqda…</span>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-full w-full" />
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 grid place-items-center p-6" role="alert" data-testid="tradingview-fallback">
            <div className="max-w-md text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-border-strong bg-surface">
                <WifiOffIcon className="size-6 text-muted-foreground" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold">Grafikni yuklab bo‘lmadi</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                TradingView vidjeti ochilmadi. Internet aloqasini yoki reklama/kontent bloklovchi kengaytmalarni tekshiring, so‘ng qayta urinib ko‘ring.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button onClick={() => setAttempt((a) => a + 1)} variant="secondary">
                  <RefreshCwIcon /> Qayta urinish
                </Button>
                <Button asChild variant="outline">
                  <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                    {current?.label ?? "Grafik"} — TradingView’da ochish <ExternalLinkIcon />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
