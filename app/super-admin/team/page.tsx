import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AdminTitle } from "@/components/admin/admin-title";
import { AddAdminForm } from "@/components/admin/add-admin-form";
import { RoleControls } from "@/components/admin/user-controls";

export default async function TeamPage() {
  const me = await requireSuperAdmin();
  const team = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      status: true,
      sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
    },
  });

  return (
    <>
      <AdminTitle
        title="Super adminlar"
        description="Platformada yagona boshqaruv paneli bor — Super admin paneli. Bu yerda unga kim kira olishini belgilaysiz. Barcha o‘zgarishlar audit jurnaliga yoziladi."
      />
      <ul className="grid gap-3" aria-label="Super adminlar">
        {team.map((m) => (
          <li key={m.id} className="card-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5" data-testid="team-row">
            <Link href={`/super-admin/users/${m.id}`} className="group min-w-0 flex-1">
              <span className="block font-medium group-hover:text-gold-soft">
                {m.name} {m.id === me.id && <span className="text-xs text-gold-soft">(siz)</span>}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {m.username ? `@${m.username} · ` : ""}
                {m.email}
              </span>
              <span className="mt-1 block font-mono text-[11px] text-muted-foreground">So‘nggi faollik: {m.sessions[0] ? formatDate(m.sessions[0].updatedAt) : "—"}</span>
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Super admin</Badge>
              {m.status === "SUSPENDED" && <Badge variant="destructive">Bloklangan</Badge>}
              {m.id !== me.id && <RoleControls userId={m.id} role="SUPER_ADMIN" />}
            </div>
          </li>
        ))}
      </ul>

      <section className="card-surface mt-8 p-5 sm:p-6" aria-labelledby="add-admin-title">
        <h2 id="add-admin-title" className="font-display text-lg font-bold">
          Super admin qo‘shish
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Faqat ishonchli odamni qo‘shing: super admin barcha bo‘limlarni, arizalarni va sozlamalarni boshqaradi. Avval u saytda ro‘yxatdan o‘tgan bo‘lishi kerak.
        </p>
        <AddAdminForm />
      </section>
    </>
  );
}
