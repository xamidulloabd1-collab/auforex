import { requireUser } from "@/lib/auth/session";
import { DASHBOARD_NAV } from "@/lib/constants";
import { SideNav } from "@/components/dashboard/side-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/dashboard");
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[240px_1fr] lg:gap-10 lg:px-8 lg:py-12">
      <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
        <p className="mb-3 hidden px-3.5 font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase lg:block">Shaxsiy kabinet</p>
        <SideNav items={DASHBOARD_NAV} label="Shaxsiy kabinet bo‘limlari" root="/dashboard" />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
