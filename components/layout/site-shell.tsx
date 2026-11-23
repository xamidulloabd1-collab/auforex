import { getViewer } from "@/lib/auth/session";
import { withFallback } from "@/lib/data/safe";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { BottomNav } from "./bottom-nav";

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const viewer = await withFallback("viewer", getViewer, null);
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <BottomNav signedIn={Boolean(viewer)} isAdmin={Boolean(viewer?.isAdmin)} />
    </div>
  );
}
