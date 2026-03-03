"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type DashboardKpi = {
  todayVisits: number;
  ordersToday: number;
  todayRevenue: number;
  pendingOrders: number;
  overdueInvoices: number;
};

export default function SalesDashboardKpi() {
  const t = useTranslations("salesMobile.dashboard");
  const locale = useLocale();

  const [data, setData] = useState<DashboardKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/sales-mobile/dashboard", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("failed_to_fetch_dashboard");
        }

        const json = await res.json();
        if (!active) return;

        setData(json.data as DashboardKpi);
      } catch {
        if (!active) return;
        setError(t("kpi.error"));
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [t]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: locale === "id" ? 0 : 2,
      }),
    [locale],
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("kpi.loading")}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/30" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error ?? t("kpi.error")}</div>;
  }

  const cards = [
    {
      key: "todayVisits",
      label: t("kpi.todayVisits"),
      value: numberFormatter.format(data.todayVisits),
      warning: false,
    },
    {
      key: "ordersToday",
      label: t("kpi.ordersToday"),
      value: numberFormatter.format(data.ordersToday),
      warning: false,
    },
    {
      key: "todayRevenue",
      label: t("kpi.todayRevenue"),
      value: currencyFormatter.format(data.todayRevenue),
      warning: false,
    },
    {
      key: "pendingOrders",
      label: t("kpi.pendingOrders"),
      value: numberFormatter.format(data.pendingOrders),
      warning: false,
    },
    {
      key: "overdueInvoices",
      label: t("kpi.overdueInvoices"),
      value: numberFormatter.format(data.overdueInvoices),
      warning: data.overdueInvoices > 0,
    },
  ];

  const isEmpty =
    data.todayVisits === 0 &&
    data.ordersToday === 0 &&
    data.todayRevenue === 0 &&
    data.pendingOrders === 0 &&
    data.overdueInvoices === 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.key}
            className={[
              "rounded-lg border p-3",
              card.warning ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200" : "",
            ].join(" ")}
          >
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-lg font-semibold leading-tight">{card.value}</p>
          </div>
        ))}
      </div>

      {isEmpty && <p className="text-sm text-muted-foreground">{t("kpi.empty")}</p>}
    </div>
  );
}
