"use client";

import * as React from "react";
import { Loader2Icon, UserPlusIcon } from "lucide-react";
import { addAdminByIdentifier } from "@/lib/actions/admin/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "./action-controls";

export function AddAdminForm() {
  const [value, setValue] = React.useState("");
  const { pending, run } = useAction();
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addAdminByIdentifier(value), { onSuccess: () => setValue("") });
      }}
    >
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Foydalanuvchi emaili yoki logini" aria-label="Email yoki login" data-testid="add-admin-input" />
      <Button type="submit" disabled={pending || value.trim().length < 3} data-testid="add-admin-submit">
        {pending ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />} Admin qilish
      </Button>
    </form>
  );
}
