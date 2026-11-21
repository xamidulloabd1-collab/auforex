"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

export function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition hover:text-foreground"
        aria-label={visible ? "Parolni yashirish" : "Parolni ko‘rsatish"}
        tabIndex={-1}
      >
        {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  );
}
