"use client";

import * as React from "react";
import { FileSearchIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { checkBooksAction } from "@/lib/actions/admin/content";
import type { BookFileReport } from "@/lib/books/file-check";
import { Button } from "@/components/ui/button";

const LABEL: Record<BookFileReport["file"] | BookFileReport["cover"], string> = {
  ok: "joyida",
  relinked: "qayta ulandi",
  missing: "topilmadi",
  none: "yo‘q",
};

/** Checks every book's PDF/cover in storage; relinks seeded books, lists files to re-upload. */
export function BookFileCheck() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [report, setReport] = React.useState<BookFileReport[] | null>(null);
  const problems = report?.filter((r) => r.file !== "ok" || r.cover === "missing" || r.cover === "relinked") ?? [];

  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-card p-4" data-testid="book-file-check">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Kitob fayllarini tekshirish</p>
          <p className="text-xs text-muted-foreground">Kitob ochilmasa (404) — PDF omborda borligini tekshiradi.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          data-testid="check-book-files"
          onClick={() =>
            start(async () => {
              const res = await checkBooksAction();
              if (!res.ok) return void toast.error(res.error);
              setReport(res.data?.report ?? []);
              toast.success(res.message ?? "Tekshirildi");
              router.refresh();
            })
          }
        >
          {pending ? <Loader2Icon className="animate-spin" /> : <FileSearchIcon />} Tekshirish
        </Button>
      </div>
      {report && (
        <ul className="grid gap-1.5 text-sm" data-testid="book-file-report">
          {problems.length === 0 ? (
            <li className="text-success">Barcha {report.length} ta kitob fayli joyida.</li>
          ) : (
            problems.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-surface px-3 py-2">
                <span className="font-medium">{r.title}</span>
                <span className={r.file === "missing" ? "text-destructive" : "text-muted-foreground"}>
                  PDF: {LABEL[r.file]}
                  {r.cover !== "none" && r.cover !== "ok" ? ` · muqova: ${LABEL[r.cover]}` : ""}
                  {r.file === "missing" ? " — “Tahrirlash” orqali PDF’ni qayta yuklang" : ""}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
