"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const SEGMENT_TRANSLATION_MAP: Record<string, string> = {
  dashboard: "dashboard",
  sales: "sales",
  inventory: "inventory",
  finance: "finance",
  hr: "hr",
  expenses: "expenses",
  delivery: "delivery",
  settings: "settings",
  customers: "customers",
  products: "products",
  warehouses: "warehouses",
  users: "users",
  roles: "roles",
  "audit-trail": "auditTrail",
  notifications: "notifications",
  import: "dataImport",
};

function getSegmentLabel(segment: string, t: (key: string) => string): string {
  const key = SEGMENT_TRANSLATION_MAP[segment];
  return key ? t(key) : segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function BreadcrumbNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{t("dashboard")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const href = "/" + segments.slice(0, index + 1).join("/");
          const isLast = index === segments.length - 1;
          const label = getSegmentLabel(segment, t);

          return (
            <React.Fragment key={href}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
