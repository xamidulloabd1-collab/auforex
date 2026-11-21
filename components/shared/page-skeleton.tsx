import { Skeleton } from "@/components/ui/skeleton";

export function GridPageSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Yuklanmoqda…</span>
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-5 h-10 w-80 max-w-full" />
          <Skeleton className="mt-4 h-4 w-[32rem] max-w-full" />
        </div>
      </div>
      <div className="mx-auto grid grid-cols-1 max-w-7xl gap-6 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="grid gap-3">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4">
      <span className="sr-only">Yuklanmoqda…</span>
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
