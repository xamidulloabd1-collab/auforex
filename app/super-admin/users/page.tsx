import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/db/generated/client";
import { effectiveStatus, SUBSCRIPTION_LABELS } from "@/lib/subscription/entitlement";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminTitle } from "@/components/admin/admin-title";

const PAGE_SIZE = 20;

export default async function AdminUsersPage({ searchParams }: PageProps<"/super-admin/users">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const filter = typeof sp.filter === "string" ? sp.filter : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const now = new Date();

  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {}),
    ...(filter === "pro" ? { subscription: { status: "PRO_ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } : {}),
    ...(filter === "free" ? { NOT: { subscription: { status: "PRO_ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } } : {}),
    ...(filter === "admin" ? { role: "SUPER_ADMIN" } : {}),
    ...(filter === "suspended" ? { status: "SUSPENDED" } : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, subscription: { select: { status: true, expiresAt: true } } },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), ...(filter !== "all" ? { filter } : {}), page: String(p) })}`;

  return (
    <>
      <AdminTitle title="Foydalanuvchilar" description={`Jami: ${total}`} />
      <form className="mb-6 flex flex-col gap-3 sm:flex-row" role="search">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Ism yoki email bo‘yicha qidirish" className="pl-10" aria-label="Qidirish" />
        </div>
        <NativeSelect name="filter" defaultValue={filter} aria-label="Filtr" className="sm:w-48">
          <option value="all">Barchasi</option>
          <option value="pro">Faol PRO</option>
          <option value="free">PRO emas</option>
          <option value="admin">Super adminlar</option>
          <option value="suspended">Bloklanganlar</option>
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Qidirish
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Foydalanuvchi</TableHead>
            <TableHead>Obuna</TableHead>
            <TableHead className="hidden md:table-cell">Rol / holat</TableHead>
            <TableHead className="hidden md:table-cell">Ro‘yxatdan o‘tgan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            const st = effectiveStatus(u.subscription);
            return (
              <TableRow key={u.id}>
                <TableCell>
                  <Link href={`/super-admin/users/${u.id}`} className="group block" data-testid="admin-user-row">
                    <span className="block font-medium group-hover:text-gold-soft">{u.name}</span>
                    <span className="block text-xs break-all text-muted-foreground">{u.email}</span>
                  </Link>
                  {(u.role === "SUPER_ADMIN" || u.status === "SUSPENDED") && (
                    <span className="mt-1.5 flex flex-wrap gap-1 md:hidden">
                      {u.role === "SUPER_ADMIN" && <Badge>Super admin</Badge>}
                      {u.status === "SUSPENDED" && <Badge variant="destructive">Bloklangan</Badge>}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={st === "PRO_ACTIVE" ? "success" : "secondary"}>{SUBSCRIPTION_LABELS[st]}</Badge>
                  {st === "PRO_ACTIVE" && u.subscription?.expiresAt && <span className="mt-1 block text-[11px] text-muted-foreground">{formatDate(u.subscription.expiresAt)} gacha</span>}
                </TableCell>
                <TableCell className="hidden space-x-1.5 md:table-cell">
                  {u.role === "SUPER_ADMIN" && <Badge>Super admin</Badge>}
                  {u.status === "SUSPENDED" ? <Badge variant="destructive">Bloklangan</Badge> : <Badge variant="outline">Faol</Badge>}
                </TableCell>
                <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{formatDate(u.createdAt)}</TableCell>
              </TableRow>
            );
          })}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                Foydalanuvchi topilmadi
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between" aria-label="Sahifalash">
          <Button asChild variant="secondary" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
            <Link href={qs(page - 1)} aria-disabled={page <= 1}>
              <ChevronLeftIcon /> Oldingi
            </Link>
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            {page} / {pages}
          </span>
          <Button asChild variant="secondary" size="sm" className={page >= pages ? "pointer-events-none opacity-50" : ""}>
            <Link href={qs(page + 1)} aria-disabled={page >= pages}>
              Keyingi <ChevronRightIcon />
            </Link>
          </Button>
        </nav>
      )}
    </>
  );
}
