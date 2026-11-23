"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExpandIcon,
  Loader2Icon,
  MinimizeIcon,
  ShieldAlertIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { clamp } from "@/lib/utils";

type Props = {
  bookId: string;
  title: string;
  initialPage: number;
  watermark: string;
};

const ZOOM_STEPS = [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];

export function PdfReader({ bookId, title, initialPage, watermark }: Props) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const renderTask = React.useRef<RenderTask | null>(null);
  const [doc, setDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = React.useState(0);
  const [page, setPage] = React.useState(Math.max(1, initialPage));
  const [pageInput, setPageInput] = React.useState(String(Math.max(1, initialPage)));
  const [inputForPage, setInputForPage] = React.useState(page);
  if (inputForPage !== page) {
    setInputForPage(page);
    setPageInput(String(page));
  }
  const [zoom, setZoom] = React.useState(1);
  const [width, setWidth] = React.useState(0);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [errorText, setErrorText] = React.useState("");
  const [rendering, setRendering] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);

  // Load the document through the authorised file route.
  React.useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        // Explicit byte-range loading: every request stays ≤ 1 MiB, which also fits serverless
        // hosts that cap a single response (Vercel 4.5 MB) — the whole PDF is never sent at once.
        const url = `/api/books/${bookId}/file`;
        const CHUNK = 1 << 20;
        const fetchRange = async (begin: number, endExclusive: number) => {
          const res = await fetch(url, { headers: { Range: `bytes=${begin}-${endExclusive - 1}` }, credentials: "same-origin" });
          if (res.status !== 206 && res.status !== 200) throw new Error(String(res.status));
          const buf = new Uint8Array(await res.arrayBuffer());
          const total = Number(res.headers.get("content-range")?.split("/")[1] ?? buf.length);
          return { data: res.status === 200 ? buf.subarray(begin, endExclusive) : buf, total };
        };
        const first = await fetchRange(0, CHUNK);
        const fail = (err: unknown) => {
          if (cancelled) return;
          console.error(err);
          setErrorText("Kitobni yuklab bo‘lmadi. Sahifani yangilab ko‘ring.");
          setStatus("error");
        };
        class RangeTransport extends pdfjs.PDFDataRangeTransport {
          override requestDataRange(begin: number, end: number) {
            void (async () => {
              for (let pos = begin; pos < end; pos += CHUNK) {
                const { data } = await fetchRange(pos, Math.min(end, pos + CHUNK));
                this.onDataRange(pos, data);
              }
            })().catch(fail);
          }
        }
        const transport = new RangeTransport(first.total, first.data);
        const task = pdfjs.getDocument({ range: transport, rangeChunkSize: CHUNK, disableAutoFetch: true, disableStream: true });
        loaded = await task.promise;
        if (cancelled) {
          void loaded.loadingTask.destroy();
          return;
        }
        setDoc(loaded);
        setNumPages(loaded.numPages);
        setPage((p) => clamp(p, 1, loaded!.numPages));
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "";
        setErrorText(
          /403|401/.test(msg)
            ? "Bu kitobni o‘qish uchun ruxsat yo‘q."
            : msg === "404"
              ? "Kitob fayli serverda topilmadi. Administrator faylni qayta yuklashi kerak."
              : "Kitobni yuklab bo‘lmadi. Sahifani yangilab ko‘ring.",
        );
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      renderTask.current?.cancel();
      if (loaded) void loaded.loadingTask.destroy();
    };
  }, [bookId]);

  // Track available width for fit-to-width rendering.
  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.floor(entries[0]!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Render the current page.
  React.useEffect(() => {
    if (!doc || !width || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        const p = await doc.getPage(page);
        if (cancelled) return;
        const base = p.getViewport({ scale: 1 });
        const fitScale = Math.min(width, 880) / base.width;
        const scale = fitScale * zoom;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const viewport = p.getViewport({ scale: scale * dpr });
        const canvas = canvasRef.current!;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
        renderTask.current?.cancel();
        const task = p.render({ canvas, viewport });
        renderTask.current = task;
        await task.promise;
      } catch (err) {
        if ((err as { name?: string })?.name !== "RenderingCancelledException") console.error(err);
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, page, width, zoom]);

  // Save reading progress (debounced).
  React.useEffect(() => {
    if (!numPages) return;
    const t = window.setTimeout(() => {
      void fetch(`/api/books/${bookId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, totalPages: numPages }),
      }).catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [page, numPages, bookId]);

  const go = React.useCallback(
    (delta: number) => {
      setPage((p) => clamp(p + delta, 1, numPages || 1));
      // On phones the page is taller than the screen: start the next page from its top.
      const top = (stageRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 112;
      if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
    },
    [numPages],
  );

  // Horizontal swipe turns pages (only when the page fits the screen, so it never fights panning).
  const touch = React.useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    const t = e.changedTouches[0];
    if (!start || !t || zoom > 1) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - start.t < 700) go(dx < 0 ? 1 : -1);
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  React.useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const zoomIndex = ZOOM_STEPS.indexOf(zoom);
  const percent = numPages ? Math.round((page / numPages) * 100) : 0;

  const pageForm = (testId: string) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(pageInput);
        if (Number.isFinite(n)) setPage(clamp(Math.round(n), 1, numPages || 1));
        (document.activeElement as HTMLElement | null)?.blur();
      }}
      className="flex items-center gap-1.5 font-mono text-sm text-muted-foreground sm:gap-1 sm:text-xs"
    >
      <input
        value={pageInput}
        onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
        inputMode="numeric"
        enterKeyHint="go"
        aria-label="Bet raqami"
        className="h-10 w-14 rounded-lg border border-input bg-surface text-center text-base text-foreground outline-none focus-visible:border-primary/70 sm:h-8 sm:w-12 sm:text-xs"
        data-testid={testId}
      />
      <span>/ {numPages || "…"}</span>
    </form>
  );

  return (
    <div ref={wrapperRef} className="flex min-h-[calc(100dvh-4rem)] flex-col bg-background" data-testid="pdf-reader">
      <div className="sticky top-16 z-30 border-b border-border bg-background/90 backdrop-blur-xl lg:top-[72px]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-3 py-2.5 sm:px-6">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Kutubxonaga qaytish">
            <Link href="/books">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <h1 className="min-w-0 flex-1 truncate font-display text-sm font-semibold">{title}</h1>

          <div className="hidden items-center gap-1 sm:flex">
            <Button variant="secondary" size="icon-sm" onClick={() => go(-1)} disabled={page <= 1} aria-label="Oldingi bet">
              <ChevronLeftIcon />
            </Button>
            {pageForm("page-input")}
            <Button variant="secondary" size="icon-sm" onClick={() => go(1)} disabled={!numPages || page >= numPages} aria-label="Keyingi bet" data-testid="next-page">
              <ChevronRightIcon />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setZoom(ZOOM_STEPS[Math.max(0, zoomIndex - 1)]!)} disabled={zoomIndex <= 0} aria-label="Kichraytirish">
              <ZoomOutIcon />
            </Button>
            <span className="hidden w-11 text-center font-mono text-xs text-muted-foreground min-[400px]:inline">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, zoomIndex + 1)]!)} disabled={zoomIndex >= ZOOM_STEPS.length - 1} aria-label="Kattalashtirish">
              <ZoomInIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden sm:inline-flex"
              aria-label={fullscreen ? "To‘liq ekrandan chiqish" : "To‘liq ekran"}
              onClick={() => (document.fullscreenElement ? document.exitFullscreen() : wrapperRef.current?.requestFullscreen())}
            >
              {fullscreen ? <MinimizeIcon /> : <ExpandIcon />}
            </Button>
          </div>
        </div>
        <Progress value={percent} className="h-0.5 rounded-none bg-transparent" indicatorClassName="rounded-none" />
      </div>

      <div ref={stageRef} className="mx-auto w-full max-w-6xl flex-1 touch-pan-y overflow-x-auto px-1.5 py-3 sm:px-6 sm:py-6" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {status === "loading" && (
          <div className="mx-auto grid max-w-3xl gap-3" aria-live="polite">
            <span className="sr-only">Kitob yuklanmoqda…</span>
            <Skeleton className="aspect-[1/1.414] w-full" />
          </div>
        )}
        {status === "error" && (
          <div role="alert" className="mx-auto mt-10 max-w-md rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-red-200">
            {errorText}
          </div>
        )}
        <div className={status === "ready" ? "relative mx-auto w-fit" : "hidden"} style={zoom > 1 ? { touchAction: "pan-x pan-y" } : undefined}>
          <canvas
            ref={canvasRef}
            className="block rounded-md bg-white shadow-[0_30px_60px_-30px_rgb(0_0_0/0.9)]"
            onContextMenu={(e) => e.preventDefault()}
            aria-label={`${title}, ${page}-bet`}
            role="img"
          />
          {/* Personalised watermark — a deterrent, not a guarantee against copying. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-md select-none">
            <div className="absolute inset-[-50%] flex rotate-[-24deg] flex-wrap content-center gap-x-24 gap-y-28 opacity-[0.07]">
              {Array.from({ length: 24 }).map((_, i) => (
                <span key={i} className="font-mono text-sm font-semibold text-black">
                  {watermark}
                </span>
              ))}
            </div>
          </div>
          {rendering && (
            <div className="absolute top-3 right-3 rounded-full bg-black/60 p-1.5">
              <Loader2Icon className="size-4 animate-spin text-white" />
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto mb-6 flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldAlertIcon className="size-3.5 shrink-0" /> Faqat shaxsiy o‘qish uchun. Tarqatish taqiqlanadi.
        </p>
      </div>

      {/* Phone page controls — within thumb reach, above the home indicator. */}
      <div aria-hidden className="h-[calc(4.5rem+env(safe-area-inset-bottom))] sm:hidden" />
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
        data-testid="reader-mobile-bar"
      >
        <div className="flex h-[4.5rem] items-center justify-between gap-2 px-3">
          <Button variant="secondary" className="h-12 flex-1" onClick={() => go(-1)} disabled={page <= 1} aria-label="Oldingi bet">
            <ChevronLeftIcon className="size-5" /> Oldingi
          </Button>
          {pageForm("page-input-mobile")}
          <Button className="h-12 flex-1" onClick={() => go(1)} disabled={!numPages || page >= numPages} aria-label="Keyingi bet" data-testid="next-page-mobile">
            Keyingi <ChevronRightIcon className="size-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
