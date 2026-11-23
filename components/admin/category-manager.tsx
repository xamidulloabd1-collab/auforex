"use client";

import * as React from "react";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { deleteCategory, moveCategory, saveCategory } from "@/lib/actions/admin/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmAction, useAction } from "./action-controls";

type Category = { id: string; name: string; order: number; count: number; countLabel?: string };

export function CategoryManager({
  kind,
  categories,
  title = "Kategoriyalar",
  reorder = false,
}: {
  kind: "COURSE" | "BOOK";
  categories: Category[];
  title?: string;
  /** Show up/down buttons (the Kategoriyalar page). */
  reorder?: boolean;
}) {
  const { pending, run } = useAction();
  const [name, setName] = React.useState("");
  const [editing, setEditing] = React.useState<{ id: string; name: string; order: number } | null>(null);

  return (
    <div className="card-surface p-5">
      <h2 className="font-display font-bold">{title}</h2>
      <ul className="mt-4 grid gap-1.5">
        {categories.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm" data-testid="category-row">
            {editing?.id === c.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => saveCategory(c.id, { name: editing.name, kind, order: editing.order }), { onSuccess: () => setEditing(null) });
                }}
              >
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-8" autoFocus />
                <Button size="sm" type="submit" disabled={pending}>
                  Saqlash
                </Button>
              </form>
            ) : (
              <>
                <span className="flex-1">{c.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{c.countLabel ?? c.count}</span>
                {reorder && (
                  <>
                    <Button variant="ghost" size="icon-sm" aria-label={`${c.name}: yuqoriga`} disabled={pending || i === 0} onClick={() => run(() => moveCategory(c.id, "up"))}>
                      <ArrowUpIcon />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`${c.name}: pastga`} disabled={pending || i === categories.length - 1} onClick={() => run(() => moveCategory(c.id, "down"))}>
                      <ArrowDownIcon />
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon-sm" aria-label="Tahrirlash" onClick={() => setEditing({ id: c.id, name: c.name, order: c.order })}>
                  <PencilIcon />
                </Button>
                <ConfirmAction
                  action={() => deleteCategory(c.id)}
                  title={`“${c.name}” o‘chirilsinmi?`}
                  description={c.count > 0 ? "Bu kategoriya ishlatilmoqda — avval kontentni boshqa kategoriyaga o‘tkazing." : "Kategoriya o‘chiriladi."}
                  confirmLabel="O‘chirish"
                  variant="ghost"
                  size="icon-sm"
                >
                  <Trash2Icon />
                </ConfirmAction>
              </>
            )}
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveCategory(null, { name, kind, order: categories.length }), { onSuccess: () => setName("") });
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Yangi kategoriya" className="h-9" data-testid={`new-category-${kind.toLowerCase()}`} />
        <Button type="submit" size="sm" disabled={pending || name.trim().length < 2}>
          <PlusIcon /> Qo‘shish
        </Button>
      </form>
    </div>
  );
}
