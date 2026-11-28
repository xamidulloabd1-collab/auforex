"use client";

import * as React from "react";
import Image from "next/image";
import { Controller, useFieldArray, useForm, useWatch, type FieldValues, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import type { z } from "zod";
import { updateSettings } from "@/lib/actions/admin/settings";
import {
  academySettingsSchema,
  accessSettingsSchema,
  faqSettingsSchema,
  footerSettingsSchema,
  founderSettingsSchema,
  homeSettingsSchema,
  subscriptionSettingsSchema,
  type SettingsKey,
  type SettingsValue,
} from "@/lib/settings/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "./action-controls";
import { ListEditor } from "./list-editor";
import { UploadField } from "./upload-field";

function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

function SaveBar({ pending }: { pending: boolean }) {
  return (
    <div className="flex justify-end">
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Saqlash
      </Button>
    </div>
  );
}

function useSettingsForm<K extends SettingsKey, T extends FieldValues>(key: K, schema: z.ZodType<T>, defaults: T) {
  const { pending, run } = useAction();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<T>({ resolver: zodResolver(schema as any), defaultValues: defaults as any });
  const onSubmit = form.handleSubmit((v) => run(() => updateSettings(key, v as unknown as SettingsValue<K>)));
  const err = (name: Path<T>) => {
    const parts = String(name).split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let e: any = form.formState.errors;
    for (const p of parts) e = e?.[p];
    return e?.message as string | undefined;
  };
  return { form, onSubmit, pending, err };
}

export function AcademyForm({ defaults }: { defaults: SettingsValue<"academy"> }) {
  const { form, onSubmit, pending, err } = useSettingsForm("academy", academySettingsSchema, defaults);
  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Akademiya nomi" error={err("name")}><Input {...form.register("name")} /></Field>
        <Field label="Platforma nomi" error={err("platformName")}><Input {...form.register("platformName")} /></Field>
      </div>
      <Field label="Slogan" error={err("slogan")}><Input {...form.register("slogan")} /></Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Telegram havolasi" error={err("telegramUrl")}><Input {...form.register("telegramUrl")} placeholder="https://t.me/…" /></Field>
        <Field label="Aloqa email (ixtiyoriy)" error={err("contactEmail")}><Input {...form.register("contactEmail")} /></Field>
      </div>
      <SaveBar pending={pending} />
    </form>
  );
}

export function HomeForm({ defaults }: { defaults: SettingsValue<"home"> }) {
  const { form, onSubmit, pending, err } = useSettingsForm("home", homeSettingsSchema, defaults);
  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <Field label="Hero sarlavhasi" error={err("heroTitle")}><Input {...form.register("heroTitle")} /></Field>
      <Field label="Hero slogani" error={err("heroSlogan")}><Input {...form.register("heroSlogan")} /></Field>
      <Field label="Hero matni" error={err("heroDescription")}><Textarea rows={3} {...form.register("heroDescription")} /></Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Asosiy tugma" error={err("primaryCta")}><Input {...form.register("primaryCta")} /></Field>
        <Field label="Ikkinchi tugma" error={err("secondaryCta")}><Input {...form.register("secondaryCta")} /></Field>
      </div>
      <Field label="Xush kelibsiz sarlavhasi" error={err("welcomeTitle")}><Input {...form.register("welcomeTitle")} /></Field>
      <Field label="Xush kelibsiz matni" hint="Xatboshilar orasida bo‘sh qator qoldiring." error={err("welcomeText")}><Textarea rows={12} {...form.register("welcomeText")} /></Field>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Field label="1-afzallik sarlavhasi" error={err("lessonsHeadline")}><Input {...form.register("lessonsHeadline")} /></Field>
        <Field label="2-afzallik sarlavhasi" error={err("libraryHeadline")}><Input {...form.register("libraryHeadline")} /></Field>
        <Field label="3-afzallik sarlavhasi" error={err("challengeHeadline")}><Input {...form.register("challengeHeadline")} /></Field>
        <Field label="1-afzallik matni" error={err("lessonsDescription")}><Textarea rows={3} {...form.register("lessonsDescription")} /></Field>
        <Field label="2-afzallik matni" error={err("libraryDescription")}><Textarea rows={3} {...form.register("libraryDescription")} /></Field>
        <Field label="3-afzallik matni" error={err("challengeDescription")}><Textarea rows={3} {...form.register("challengeDescription")} /></Field>
      </div>
      <SaveBar pending={pending} />
    </form>
  );
}

export function FaqForm({ defaults }: { defaults: SettingsValue<"faq"> }) {
  const { form, onSubmit, pending, err } = useSettingsForm("faq", faqSettingsSchema, defaults);
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {fields.map((f, i) => (
        <div key={f.id} className="grid gap-3 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gold-soft">{i + 1}</span>
            <Input {...form.register(`items.${i}.question`)} placeholder="Savol" />
            <Button type="button" variant="ghost" size="icon" aria-label="O‘chirish" onClick={() => remove(i)}>
              <Trash2Icon />
            </Button>
          </div>
          <Textarea rows={3} {...form.register(`items.${i}.answer`)} placeholder="Javob" />
          {(err(`items.${i}.question`) || err(`items.${i}.answer`)) && <p className="text-xs text-red-300">{err(`items.${i}.question`) ?? err(`items.${i}.answer`)}</p>}
        </div>
      ))}
      <div className="flex justify-between">
        <Button type="button" variant="outline" size="sm" onClick={() => append({ question: "", answer: "" })}>
          <PlusIcon /> Savol qo‘shish
        </Button>
        <SaveBar pending={pending} />
      </div>
    </form>
  );
}

export function FooterForm({ defaults }: { defaults: SettingsValue<"footer"> }) {
  const { form, onSubmit, pending, err } = useSettingsForm("footer", footerSettingsSchema, defaults);
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "links" });
  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <Field label="Akademiya haqida qisqacha" error={err("about")}><Textarea rows={3} {...form.register("about")} /></Field>
      <Field label="Risk ogohlantirishi" error={err("disclaimer")}><Textarea rows={5} {...form.register("disclaimer")} /></Field>
      <div className="grid gap-2">
        <Label>Foydali havolalar</Label>
        {fields.map((f, i) => (
          <div key={f.id} className="flex gap-2">
            <Input {...form.register(`links.${i}.label`)} placeholder="Nomi" />
            <Input {...form.register(`links.${i}.href`)} placeholder="/lessons yoki https://…" />
            <Button type="button" variant="ghost" size="icon" aria-label="O‘chirish" onClick={() => remove(i)}>
              <Trash2Icon />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => append({ label: "", href: "" })}>
          <PlusIcon /> Havola qo‘shish
        </Button>
      </div>
      <SaveBar pending={pending} />
    </form>
  );
}

export function SubscriptionSettingsForm({ defaults }: { defaults: SettingsValue<"subscription"> }) {
  const { form, onSubmit, pending, err } = useSettingsForm("subscription", subscriptionSettingsSchema, defaults);
  return (
    <form onSubmit={onSubmit} className="grid gap-5" data-testid="subscription-settings">
      <fieldset className="grid gap-5 rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 sm:p-5">
        <legend className="px-1 font-display text-sm font-bold text-gold-soft">Narx va sotib olish</legend>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="PRO narxi" hint="Faqat raqam, masalan 199000" error={err("price")}>
            <Input inputMode="numeric" {...form.register("price", { valueAsNumber: true })} data-testid="price-input" />
          </Field>
          <Field label="Eski narx (ustiga chizilgan)" hint="Bo‘sh qoldirilsa ko‘rsatilmaydi" error={err("oldPrice")}>
            <Input
              inputMode="numeric"
              {...form.register("oldPrice", { setValueAs: (v: unknown) => (v === "" || v == null || Number.isNaN(v) ? null : Number(v)) })}
            />
          </Field>
          <Field label="Valyuta" error={err("currency")}><Input {...form.register("currency")} /></Field>
          <Field label="Davr belgisi" hint="Masalan “oyiga”. Bo‘sh — ko‘rsatilmaydi" error={err("period")}><Input {...form.register("period")} /></Field>
        </div>
        <Field label="Sotib olish havolasi" hint="Tugma bosilganda shu manzil ochiladi va ariza super admin paneliga tushadi" error={err("purchaseUrl")}>
          <Input type="url" {...form.register("purchaseUrl")} placeholder="https://t.me/…" />
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Tugma matni" error={err("purchaseButton")}><Input {...form.register("purchaseButton")} /></Field>
          <Field label="Tasdiqlashdagi standart muddat" error={err("defaultDurationDays")}>
            <NativeSelect {...form.register("defaultDurationDays", { valueAsNumber: true })}>
              <option value={0}>Muddatsiz (bekor qilinmaguncha)</option>
              <option value={30}>1 oy</option>
              <option value={90}>3 oy</option>
              <option value={180}>6 oy</option>
              <option value={365}>1 yil</option>
            </NativeSelect>
          </Field>
        </div>
      </fieldset>
      <Field label="Sarlavha" error={err("headline")}><Input {...form.register("headline")} /></Field>
      <Field label="Tavsif" error={err("description")}><Textarea rows={3} {...form.register("description")} /></Field>
      <Field label="PRO afzalliklari" error={err("benefits")}>
        <Controller control={form.control} name="benefits" render={({ field }) => <ListEditor value={field.value} onChange={field.onChange} max={12} />} />
      </Field>
      <Field label="To‘lov holati matni" error={err("comingSoonText")}><Input {...form.register("comingSoonText")} /></Field>
      <Field label="Aloqa izohi" error={err("contactNote")}><Input {...form.register("contactNote")} /></Field>
      <SaveBar pending={pending} />
    </form>
  );
}

export function AccessForm({ defaults }: { defaults: SettingsValue<"access"> }) {
  const { form, onSubmit, pending } = useSettingsForm("access", accessSettingsSchema, defaults);
  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <Controller
        control={form.control}
        name="tradingviewRequiresPro"
        render={({ field }) => (
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3">
            <span>
              <span className="block text-sm font-medium">TradingView faqat PRO uchun</span>
              <span className="block text-xs text-muted-foreground">O‘chirilgan bo‘lsa, ro‘yxatdan o‘tgan barcha foydalanuvchilar ko‘ra oladi.</span>
            </span>
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          </label>
        )}
      />
      <Controller
        control={form.control}
        name="sequentialLessons"
        render={({ field }) => (
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3">
            <span>
              <span className="block text-sm font-medium">Darslar ketma-ket ochilsin</span>
              <span className="block text-xs text-muted-foreground">
                Har bir kursda keyingi dars oldingisi yakunlangach ochiladi. Adminlar uchun hamma darslar ochiq.
              </span>
            </span>
            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="sequential-lessons" />
          </label>
        )}
      />
      <SaveBar pending={pending} />
    </form>
  );
}

export function FounderForm({ defaults, portraitUrl }: { defaults: SettingsValue<"founder">; portraitUrl: string | null }) {
  const { form, onSubmit, pending, err } = useSettingsForm("founder", founderSettingsSchema, defaults);
  const [preview, setPreview] = React.useState(portraitUrl);
  const portraitKey = useWatch({ control: form.control, name: "portraitKey" });
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]" data-testid="founder-form">
      <div className="card-surface grid gap-5 p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Ism familiya" error={err("name")}><Input {...form.register("name")} placeholder="Hali kiritilmagan" data-testid="founder-name" /></Field>
          <Field label="Lavozim / roli" error={err("role")}><Input {...form.register("role")} placeholder="Masalan: AU Forex Academy asoschisi" /></Field>
        </div>
        <Field label="Biografiya" hint="Faqat tasdiqlangan faktlarni yozing." error={err("bio")}><Textarea rows={7} {...form.register("bio")} /></Field>
        <Field label="Akademiya missiyasi" error={err("mission")}><Textarea rows={4} {...form.register("mission")} /></Field>
        <Field label="Ta’lim falsafasi" error={err("philosophy")}><Textarea rows={4} {...form.register("philosophy")} /></Field>
        <Field label="Founder xabari" error={err("message")}><Textarea rows={4} {...form.register("message")} /></Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Telegram" error={err("socials.telegram")}><Input {...form.register("socials.telegram")} placeholder="https://t.me/…" /></Field>
          <Field label="Instagram" error={err("socials.instagram")}><Input {...form.register("socials.instagram")} placeholder="https://instagram.com/…" /></Field>
          <Field label="YouTube" error={err("socials.youtube")}><Input {...form.register("socials.youtube")} placeholder="https://youtube.com/…" /></Field>
          <Field label="Veb-sayt" error={err("socials.website")}><Input {...form.register("socials.website")} placeholder="https://…" /></Field>
        </div>
      </div>
      <div className="grid content-start gap-5">
        <div className="card-surface grid gap-4 p-6">
          {preview && (
            <div className="relative mx-auto aspect-[4/5] w-44 overflow-hidden rounded-2xl border border-border">
              <Image src={preview} alt="Portret" fill sizes="176px" className="object-cover" unoptimized />
            </div>
          )}
          <UploadField
            kind="founder"
            accept="image/png,image/jpeg,image/webp"
            label="Portret"
            hint="PNG/JPG/WEBP, 4:5 nisbat tavsiya etiladi"
            testId="founder-upload"
            currentLabel={portraitKey ? "Portret yuklangan" : null}
            onUploaded={(f, original) => {
              form.setValue("portraitKey", f.key);
              setPreview(URL.createObjectURL(original));
            }}
            onClear={() => {
              form.setValue("portraitKey", null);
              setPreview(null);
            }}
          />
        </div>
        <Button type="submit" size="lg" disabled={pending} data-testid="founder-save">
          {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Saqlash
        </Button>
      </div>
    </form>
  );
}
