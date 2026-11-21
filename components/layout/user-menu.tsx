"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CrownIcon, LayoutDashboardIcon, LogOutIcon, SettingsIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { initials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type HeaderUser = {
  name: string;
  email: string;
  image: string | null;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  hasPremium: boolean;
  isPro: boolean;
};

export function useSignOut() {
  const router = useRouter();
  return async () => {
    const { error } = await authClient.signOut();
    if (error) {
      toast.error("Chiqishda xatolik yuz berdi");
      return;
    }
    router.push("/");
    router.refresh();
  };
}

export function UserMenu({ user }: { user: HeaderUser }) {
  const signOut = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full p-0.5 outline-none transition hover:ring-2 hover:ring-primary/30 focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Foydalanuvchi menyusi"
        data-testid="user-menu-trigger"
      >
        <Avatar className="size-9">
          {user.image && <AvatarImage src={user.image} alt="" />}
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
          {user.isPro && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-gold-soft">
              <CrownIcon className="size-3" /> PRO
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboardIcon /> Shaxsiy kabinet
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/subscription">
            <CrownIcon /> Obuna
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <SettingsIcon /> Profil sozlamalari
          </Link>
        </DropdownMenuItem>
        {user.isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/super-admin" data-testid="admin-link">
              <ShieldCheckIcon /> Super admin panel
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void signOut()} data-testid="logout-button">
          <LogOutIcon /> Chiqish
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
