import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { effectiveStatus, SUBSCRIPTION_LABELS } from "@/lib/subscription/entitlement";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AdminTitle } from "@/components/admin/admin-title";
import { AccountControls, SubscriptionControls } from "@/components/admin/user-controls";
import { SettingsCard } from "@/components/dashboard/settings-forms";

export default async function AdminUserDetailPage({ params }: PageProps<"/super-admin/users/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      emailVerified: true,
      role: true,
      status: true,
      createdAt: true,
      profile: { select: { telegram: true, experienceLevel: true } },
      subscription: { select: { status: true, startedAt: true, expiresAt: true, source: true, note: true, grantedBy: { select: { name: true } } } },
      _count: { select: { sessions: true, submissions: true, achievements: true } },
    },
  });
  if (!user) notFound();
  const [completedLessons, booksOpened] = await Promise.all([
    prisma.lessonProgress.count({ where: { userId: id, completedAt: { not: null } } }),
    prisma.readingProgress.count({ where: { userId: id } }),
  ]);
  const st = effectiveStatus(user.subscription);
  const expiresValue = user.subscription?.expiresAt ? new Date(user.subscription.expiresAt.getTime() + 5 * 3600_000).toISOString().slice(0, 10) : "";

  return (
    <>
      <Link href="/super-admin/users" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Foydalanuvchilar
      </Link>
      <AdminTitle title={user.name} description={user.email} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SettingsCard title="Ma’lumotlar">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Rol</dt>
            <dd>{user.role === "SUPER_ADMIN" ? <Badge>Super admin</Badge> : "Foydalanuvchi"}</dd>
            <dt className="text-muted-foreground">Login</dt>
            <dd>{user.username ?? "—"}</dd>
            <dt className="text-muted-foreground">Holat</dt>
            <dd>{user.status === "ACTIVE" ? <Badge variant="success">Faol</Badge> : <Badge variant="destructive">Bloklangan</Badge>}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user.emailVerified ? "Tasdiqlangan" : "Tasdiqlanmagan"}</dd>
            <dt className="text-muted-foreground">Telegram</dt>
            <dd>{user.profile?.telegram ? `@${user.profile.telegram}` : "—"}</dd>
            <dt className="text-muted-foreground">Ro‘yxatdan o‘tgan</dt>
            <dd>{formatDateTime(user.createdAt)}</dd>
            <dt className="text-muted-foreground">Faol sessiyalar</dt>
            <dd>{user._count.sessions}</dd>
            <dt className="text-muted-foreground">Yakunlangan darslar</dt>
            <dd>{completedLessons}</dd>
            <dt className="text-muted-foreground">Ochilgan kitoblar</dt>
            <dd>{booksOpened}</dd>
            <dt className="text-muted-foreground">Challenge topshiriqlari</dt>
            <dd>{user._count.submissions}</dd>
          </dl>
        </SettingsCard>

        <SettingsCard title="Obuna" description="PRO huquqi qo‘lda beriladi; to‘lov tizimi hali ulanmagan.">
          <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={st === "PRO_ACTIVE" ? "success" : "secondary"} data-testid="admin-sub-status">
              {SUBSCRIPTION_LABELS[st]}
            </Badge>
            {user.subscription?.startedAt && <span className="text-muted-foreground">Boshlangan: {formatDate(user.subscription.startedAt)}</span>}
            {user.subscription?.expiresAt && <span className="text-muted-foreground">· Tugash: {formatDate(user.subscription.expiresAt)}</span>}
            {user.subscription?.grantedBy && <span className="text-muted-foreground">· Bergan: {user.subscription.grantedBy.name}</span>}
          </div>
          {user.subscription?.note && <p className="mb-5 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">Izoh: {user.subscription.note}</p>}
          <SubscriptionControls userId={user.id} isActive={st === "PRO_ACTIVE"} expiresAt={expiresValue} />
        </SettingsCard>

        <SettingsCard title="Hisobni boshqarish">
          <AccountControls userId={user.id} status={user.status} role={user.role} isSelf={user.id === admin.id} />
        </SettingsCard>
      </div>
    </>
  );
}
