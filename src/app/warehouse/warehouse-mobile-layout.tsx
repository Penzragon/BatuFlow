"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LayoutDashboard, ClipboardList, PackageOpen, ScanLine, Search, LogOut, Languages } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";
import { locales, type Locale } from "@/i18n/config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  session: Session;
}

const navPaths = [
  { href: "/warehouse/dashboard", key: "home", icon: LayoutDashboard },
  { href: "/warehouse/pick-lists", key: "pickLists", icon: ClipboardList },
  { href: "/warehouse/receipts", key: "receipts", icon: PackageOpen },
  { href: "/warehouse/opname", key: "opname", icon: ScanLine },
  { href: "/warehouse/stock-lookup", key: "stock", icon: Search },
] as const;

export default function WarehouseMobileLayout({ children, session }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = useLocale();
  const t = useTranslations("warehousePortal");

  function handleLocaleChange(locale: Locale) {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`;
    router.refresh();
    window.location.reload();
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-0 text-sm font-bold">
            <span className="text-primary">Batu</span>
            <span className="text-foreground">Flow</span>
          </span>
          <span className="text-xs text-muted-foreground">{t("warehouseLabel")}</span>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Change language">
                <Languages size={18} className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {locales.map((locale) => (
                <DropdownMenuItem
                  key={locale}
                  onClick={() => handleLocaleChange(locale)}
                  className={currentLocale === locale ? "bg-accent" : undefined}
                >
                  {locale === "en" ? "English" : "Bahasa Indonesia"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="max-w-[100px] truncate text-xs text-muted-foreground">{session.user?.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-16">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t bg-background">
        {navPaths.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={20} />
              <span>{t(item.key)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
