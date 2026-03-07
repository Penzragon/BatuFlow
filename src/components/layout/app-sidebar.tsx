"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Landmark,
  Users,
  Receipt,
  Truck,
  Settings,
  ChevronDown,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const iconSize = 20;

const navItems = [
  {
    labelKey: "dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    children: undefined,
    disabled: false,
  },
  {
    labelKey: "salesCrm",
    href: "/sales",
    icon: ShoppingCart,
    children: [
      { labelKey: "customers", href: "/sales/customers" },
      { labelKey: "visits", href: "/sales/visits" },
      { labelKey: "salesOrders", href: "/sales/orders" },
      { labelKey: "deliveryOrders", href: "/sales/delivery-orders" },
      { labelKey: "invoices", href: "/sales/invoices" },
      { labelKey: "commissions", href: "/sales/commissions" },
      { labelKey: "leads", href: "/sales/leads" },
      { labelKey: "salesTargets", href: "/sales/targets" },
      { labelKey: "analytics", href: "/sales/analytics" },
    ],
    disabled: false,
  },
  {
    labelKey: "inventory",
    href: "/inventory",
    icon: Package,
    children: [
      { labelKey: "products", href: "/inventory/products" },
      { labelKey: "warehouses", href: "/inventory/warehouses" },
      { labelKey: "stockOnHand", href: "/inventory/stock" },
      { labelKey: "goodsReceipts", href: "/inventory/goods-receipts" },
      { labelKey: "pickLists", href: "/inventory/pick-lists" },
      { labelKey: "stockOpname", href: "/inventory/stock-opname" },
      { labelKey: "handovers", href: "/inventory/handovers" },
    ],
    disabled: false,
  },
  {
    labelKey: "finance",
    href: "/finance",
    icon: Landmark,
    children: [
      { labelKey: "accounts", href: "/finance/accounts" },
      { labelKey: "journalEntries", href: "/finance/journal-entries" },
      { labelKey: "reports", href: "/finance/reports" },
      { labelKey: "periods", href: "/finance/periods" },
    ],
    disabled: false,
  },
  {
    labelKey: "hrPayroll",
    href: "/hr",
    icon: Users,
    children: [
      { labelKey: "employees", href: "/hr/employees" },
      { labelKey: "attendance", href: "/hr/attendance" },
      { labelKey: "leave", href: "/hr/leave" },
      { labelKey: "payroll", href: "/hr/payroll" },
    ],
    disabled: false,
  },
  {
    labelKey: "expenses",
    href: "/expenses",
    icon: Receipt,
    children: [
      { labelKey: "allExpenses", href: "/expenses" },
      { labelKey: "expenseCategories", href: "/expenses/categories" },
      { labelKey: "expenseReports", href: "/expenses/reports" },
    ],
    disabled: false,
  },
  {
    labelKey: "delivery",
    href: "/delivery",
    icon: Truck,
    children: [
      { labelKey: "vehicles", href: "/delivery/vehicles" },
      { labelKey: "trips", href: "/delivery/trips" },
      { labelKey: "deliveryBoard", href: "/delivery/board" },
    ],
    disabled: false,
  },
];

const settingsItems = [
  { labelKey: "users", href: "/settings/users" },
  { labelKey: "roles", href: "/settings/roles" },
  { labelKey: "auditTrail", href: "/settings/audit-trail" },
  { labelKey: "notifications", href: "/settings/notifications" },
  { labelKey: "dataImport", href: "/settings/import" },
];

function NavItem({
  item,
  t,
  pathname,
}: {
  item: (typeof navItems)[number];
  t: (key: string) => string;
  pathname: string;
}) {
  const Icon = item.icon;
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const hasChildren = item.children && item.children.length > 0;
  const isChildActive =
    hasChildren &&
    item.children!.some(
      (c) => pathname === c.href || pathname.startsWith(`${c.href}/`)
    );
  const defaultOpen = isActive || isChildActive;

  if (item.disabled) {
    return (
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex w-full cursor-not-allowed items-center gap-2 rounded-md p-2 text-sm text-muted-foreground opacity-60">
              <Icon size={iconSize} className="shrink-0 [&>svg]:size-5" />
              <span className="truncate">{t(item.labelKey)}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">{t("comingSoon")}</TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    );
  }

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive} tooltip={t(item.labelKey)}>
          <Link href={item.href} className="[&>svg]:size-5">
            <Icon size={iconSize} />
            <span>{t(item.labelKey)}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible defaultOpen={defaultOpen} asChild>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={isActive || isChildActive}
            tooltip={t(item.labelKey)}
          >
            <Icon size={iconSize} className="[&>svg]:size-5" />
            <span>{t(item.labelKey)}</span>
            <ChevronDown className="ml-auto size-4 shrink-0 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children!.map((child) => {
              const childActive =
                pathname === child.href || pathname.startsWith(`${child.href}/`);
              return (
                <SidebarMenuSubItem key={child.href}>
                  <SidebarMenuSubButton asChild isActive={childActive}>
                    <Link href={child.href}>{t(child.labelKey)}</Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AppSidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const isSettingsActive =
    pathname === "/settings" || pathname.startsWith("/settings/");

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border bg-white"
    >
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-0 group-data-[collapsible=icon]:justify-center"
        >
          <span className="text-lg font-semibold text-[#2563EB]">Batu</span>
          <span className="text-lg font-semibold text-foreground">Flow</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <NavItem key={item.href} item={item} t={t} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible
                defaultOpen={
                  pathname === "/settings" || pathname.startsWith("/settings/")
                }
                asChild
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={isSettingsActive}
                      tooltip={t("settings")}
                    >
                      <Settings size={iconSize} className="[&>svg]:size-5" />
                      <span>{t("settings")}</span>
                      <ChevronDown className="ml-auto size-4 shrink-0 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {settingsItems.map((child) => {
                        const childActive =
                          pathname === child.href ||
                          pathname.startsWith(`${child.href}/`);
                        return (
                          <SidebarMenuSubItem key={child.href}>
                            <SidebarMenuSubButton asChild isActive={childActive}>
                              <Link href={child.href}>
                                {t(child.labelKey)}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}
