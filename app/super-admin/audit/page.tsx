import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AUDIT_LABELS } from "@/lib/audit";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminTitle } from "@/components/admin/admin-title";

const PAGE_SIZE = 40;

export default async function AuditPage({ searchParams }: PageProps<"/super-admin/audit">) {
  await requireSuperAdmin();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [total, logs] = await Promise.all([
    prisma.adminAuditLog.count(),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, action: true, targetType: true, summary: true, ipAddress: true, createdAt: true, actor: { select: { name: true, email: true } } },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <>
      <AdminTitle title="Audit jurnali" description="Muhim admin amallari (obuna, rollar, kontent, sozlamalar) shu yerda qayd etiladi." />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vaqt</TableHead>
            <TableHead className="hidden md:table-cell">Admin</TableHead>
            <TableHead>Amal</TableHead>
            <TableHead>Tafsilot</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(l.createdAt)}</TableCell>
              <TableCell className="hidden md:table-cell text-sm">{l.actor ? l.actor.name : "—"}</TableCell>
              <TableCell>
                <Badge variant="secondary">{AUDIT_LABELS[l.action] ?? l.action}</Badge>
              </TableCell>
              <TableCell className="max-w-md text-sm text-muted-foreground">
                {l.summary}
                {l.ipAddress && <span className="ml-2 font-mono text-[11px] opacity-70">{l.ipAddress}</span>}
              </TableCell>
            </TableRow>
          ))}
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                Hali yozuv yo‘q.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {pages > 1 && (
        <div className="mt-6 flex justify-between">
          <Button asChild variant="secondary" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
            <Link href={`?page=${page - 1}`}>Oldingi</Link>
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            {page}/{pages}
          </span>
          <Button asChild variant="secondary" size="sm" className={page >= pages ? "pointer-events-none opacity-50" : ""}>
            <Link href={`?page=${page + 1}`}>Keyingi</Link>
          </Button>
        </div>
      )}
    </>
  );
}
