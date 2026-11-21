"use client";

import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Editable list of short strings (objectives, requirements, benefits…). */
export function ListEditor({ value, onChange, placeholder, max = 20, addLabel = "Qo‘shish" }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number; addLabel?: string }) {
  return (
    <div className="grid gap-2">
      {value.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input value={item} placeholder={placeholder} onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))} />
          <Button type="button" variant="ghost" size="icon" aria-label="O‘chirish" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <Trash2Icon />
          </Button>
        </div>
      ))}
      {value.length < max && (
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onChange([...value, ""])}>
          <PlusIcon /> {addLabel}
        </Button>
      )}
    </div>
  );
}
