"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, CircleIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  lessonId: string;
  source: "UPLOAD" | "EMBED";
  embedUrl: string | null;
  posterUrl: string | null;
  hasVideo: boolean;
  initialPosition: number;
  initialCompleted: boolean;
  watermark: string;
  title: string;
};

async function postProgress(lessonId: string, body: { positionSeconds: number; durationSeconds?: number | null; completed?: boolean }, keepalive = false) {
  const res = await fetch(`/api/lessons/${lessonId}/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Progress saqlanmadi");
  return (await res.json()) as { percent: number; completed: boolean };
}

export function LessonPlayer(props: Props) {
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const lastSent = React.useRef(0);
  const [completed, setCompleted] = React.useState(props.initialCompleted);
  const [marking, setMarking] = React.useState(false);

  const send = React.useCallback(
    async (opts: { completed?: boolean; keepalive?: boolean } = {}) => {
      const v = videoRef.current;
      if (!v || !Number.isFinite(v.duration)) return;
      lastSent.current = Date.now();
      try {
        const res = await postProgress(
          props.lessonId,
          { positionSeconds: v.currentTime, durationSeconds: v.duration, completed: opts.completed },
          opts.keepalive,
        );
        if (res.completed && !completed) {
          setCompleted(true);
          router.refresh();
        }
      } catch {
        // progress is best-effort; the next tick will retry
      }
    },
    [props.lessonId, completed, router],
  );

  React.useEffect(() => {
    const onHide = () => void send({ keepalive: true });
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void send({ keepalive: true });
    };
  }, [send]);

  async function markComplete() {
    setMarking(true);
    try {
      const v = videoRef.current;
      await postProgress(props.lessonId, {
        positionSeconds: v?.currentTime ?? 0,
        durationSeconds: v && Number.isFinite(v.duration) ? v.duration : null,
        completed: true,
      });
      setCompleted(true);
      toast.success("Dars yakunlandi deb belgilandi");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setMarking(false);
    }
  }

  return (
    <div>
      <div className="relative -mx-4 aspect-video overflow-hidden border-y border-border-strong bg-black shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)] sm:mx-0 sm:rounded-2xl sm:border">
        {!props.hasVideo ? (
          <div className="grid size-full place-items-center p-6 text-center text-sm text-muted-foreground">Bu dars uchun video hali yuklanmagan.</div>
        ) : props.source === "UPLOAD" ? (
          <video
            ref={videoRef}
            className="size-full bg-black"
            src={`/api/lessons/${props.lessonId}/video`}
            poster={props.posterUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            onContextMenu={(e) => e.preventDefault()}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (props.initialPosition > 5 && props.initialPosition < v.duration - 10) v.currentTime = props.initialPosition;
            }}
            onTimeUpdate={() => {
              if (Date.now() - lastSent.current > 15_000) void send();
            }}
            onPause={() => void send()}
            onEnded={() => void send({ completed: true })}
            aria-label={props.title}
            data-testid="lesson-video"
          >
            Brauzeringiz video ijrosini qo‘llab-quvvatlamaydi.
          </video>
        ) : (
          <iframe
            src={props.embedUrl ?? undefined}
            title={props.title}
            className="size-full"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
          />
        )}
        {props.hasVideo && (
          <span aria-hidden className="pointer-events-none absolute top-3 right-4 font-mono text-[10px] tracking-wider text-white/25 select-none">
            {props.watermark}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className={cn("inline-flex items-center gap-2 text-sm", completed ? "text-success" : "text-muted-foreground")} data-testid="lesson-status">
          {completed ? <CheckCircle2Icon className="size-4" /> : <CircleIcon className="size-4" />}
          {completed ? "Dars yakunlangan" : "Dars hali yakunlanmagan"}
        </p>
        {!completed && (
          <Button variant="secondary" size="sm" onClick={markComplete} disabled={marking} data-testid="mark-complete">
            {marking ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />}
            Yakunlandi deb belgilash
          </Button>
        )}
      </div>
    </div>
  );
}
