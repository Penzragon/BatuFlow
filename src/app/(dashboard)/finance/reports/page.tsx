"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BarChart3, TrendingUp, Scale, BookOpen, Receipt } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const reportLinks = [
  {
    href: "/finance/reports/trial-balance",
    titleKey: "trialBalance",
    descKey: "trialBalanceDescription",
    icon: BarChart3,
  },
  {
    href: "/finance/reports/income-statement",
    titleKey: "incomeStatement",
    descKey: "incomeStatementDescription",
    icon: TrendingUp,
  },
  {
    href: "/finance/reports/balance-sheet",
    titleKey: "balanceSheet",
    descKey: "balanceSheetDescription",
    icon: Scale,
  },
  {
    href: "/finance/reports/gl-detail",
    titleKey: "glDetail",
    descKey: "glDetailDescription",
    icon: BookOpen,
  },
  {
    href: "/finance/reports/ppn-summary",
    titleKey: "ppnSummary",
    descKey: "ppnSummaryDescription",
    icon: Receipt,
  },
] as const;

export default function FinancialReportsPage() {
  const t = useTranslations("reports");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportLinks.map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>{t(report.titleKey)}</CardTitle>
                      <CardDescription>{t(report.descKey)}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
