"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { signOut } from "next-auth/react";
import { Search } from "lucide-react";
import { SearchDialog } from "@/components/shared/search-dialog";
import { Session } from "next-auth";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { NotificationBell } from "./notification-bell";
import { ROLE_LABELS } from "@/lib/constants";
import { locales, type Locale } from "@/i18n/config";

interface TopBarProps {
  session: Session | null;
}

function LanguageSwitcher() {
  const router = useRouter();
  const currentLocale = useLocale();

  function handleLocaleChange(locale: Locale) {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`;
    router.refresh();
    window.location.reload();
  }

  return (
    <Select
      onValueChange={(v) => handleLocaleChange(v as Locale)}
      value={currentLocale}
    >
      <SelectTrigger
        className="h-9 w-[100px] border-0 bg-transparent shadow-none"
        aria-label="Select language"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locales.map((locale) => (
          <SelectItem key={locale} value={locale}>
            {locale === "en" ? "EN" : "ID"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TopBar({ session }: TopBarProps) {
  const t = useTranslations("nav");
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-white px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="rounded-lg" />
        <BreadcrumbNav />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-lg text-muted-foreground"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="size-4" />
          <span className="hidden sm:inline">{t("searchPlaceholder")}</span>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:inline-flex">
            {t("searchShortcut")}
          </kbd>
        </Button>
        <LanguageSwitcher />
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 gap-2 rounded-lg px-2"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="rounded-full bg-[#2563EB]/10 text-sm font-medium text-[#2563EB]">
                  {session?.user?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden flex-col items-start text-left sm:flex sm:flex-col">
                <span className="text-sm font-medium">
                  {session?.user?.name ?? "User"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {session?.user?.role
                    ? ROLE_LABELS[session.user.role]
                    : "—"}
                </span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-lg">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">
                  {session?.user?.name ?? "User"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {session?.user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile">{t("profile")}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/audit-trail?filter=me">{t("myActivity")}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              {t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
