import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { CHALLENGE_STATUS_LABELS, CHALLENGE_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminTitle } from "@/components/admin/admin-title";

export default async function AdminChallengesPage() {
  await requireAdmin();
  const challenges = await prisma.challenge.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      startsAt: true,
      endsAt: true,
      _count: { select: { submissions: true, questions: true, rewards: true } },
      submissions: { where: { status: "PENDING" }, select: { id: true } },
    },
  });
  return (
    <>
      <AdminTitle
        title="Challenge’lar"
        description="Ta’limiy challenge’lar, savollar, mukofotlar va topshiriqlarni baholash."
        actions={
          <Button asChild data-testid="new-challenge">
            <Link href="/super-admin/challenges/new">
              <PlusIcon /> Yangi challenge
            </Link>
          </Button>
        }
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Challenge</TableHead>
            <TableHead>Holat</TableHead>
            <TableHead className="hidden md:table-cell">Muddat</TableHead>
            <TableHead className="hidden md:table-cell">Topshiriqlar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {challenges.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link href={`/super-admin/challenges/${c.id}`} className="group block">
                  <span className="block font-medium group-hover:text-gold-soft">{c.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {CHALLENGE_TYPE_LABELS[c.type]}
                    {c.type === "QUIZ" ? ` · ${c._count.questions} savol` : ""} · {c._count.rewards} mukofot
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant={c.status === "PUBLISHED" ? "success" : c.status === "DRAFT" ? "warning" : "secondary"}>{CHALLENGE_STATUS_LABELS[c.status]}</Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                {formatDate(c.startsAt)} — {formatDate(c.endsAt)}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Link href={`/super-admin/challenges/${c.id}/submissions`} className="text-gold-soft hover:underline">
                  {c._count.submissions} ta
                </Link>
                {c.submissions.length > 0 && (
                  <Badge variant="warning" className="ml-2">
                    {c.submissions.length} kutmoqda
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
          {challenges.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                Hali challenge yaratilmagan.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
