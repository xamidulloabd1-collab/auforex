import { SiteShell } from "@/components/layout/site-shell";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
