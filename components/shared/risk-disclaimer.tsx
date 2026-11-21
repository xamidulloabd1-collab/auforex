import { ShieldAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function RiskDisclaimer({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <aside
      role="note"
      className={cn("flex gap-3 rounded-2xl border border-warning/25 bg-warning/[0.06] p-4 text-sm leading-relaxed text-amber-100/85", className)}
    >
      <ShieldAlertIcon className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden />
      <div>
        {children ?? (
          <>
            <strong className="font-semibold text-amber-200">Risk haqida ogohlantirish.</strong> Moliyaviy bozorlarda savdo qilish yuqori xavf bilan bog‘liq va mablag‘ yo‘qotilishiga olib kelishi mumkin. Materiallar faqat ta’lim maqsadida berilgan va investitsiya maslahati emas. Hech qanday natija kafolatlanmaydi.
          </>
        )}
      </div>
    </aside>
  );
}
