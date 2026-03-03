import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, ClipboardCheck, ListChecks, ShoppingCart, Users } from "lucide-react";
import SalesDashboardKpi from "./sales-dashboard-kpi";

export default async function SalesDashboardPage() {
  const t = await getTranslations("salesMobile.dashboard");

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>

      <SalesDashboardKpi />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</p>
        <div className="grid grid-cols-1 gap-2">
          <Link href="/sales-mobile/visits/new" className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/70 p-3 shadow-sm transition hover:bg-blue-100/70">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-600/10 p-2"><ClipboardCheck size={16} className="text-blue-700" /></div>
              <div>
                <p className="font-medium">{t("cards.newCheckIn.title")}</p>
                <p className="text-xs text-muted-foreground">{t("cards.newCheckIn.description")}</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-blue-700" />
          </Link>

          <Link href="/sales-mobile/orders/new" className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50/70 p-3 shadow-sm transition hover:bg-green-100/70">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-600/10 p-2"><ShoppingCart size={16} className="text-green-700" /></div>
              <div>
                <p className="font-medium">{t("cards.newOrder.title")}</p>
                <p className="text-xs text-muted-foreground">{t("cards.newOrder.description")}</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-green-700" />
          </Link>

          <div className="grid grid-cols-2 gap-2">
            <Link href="/sales-mobile/customers" className="rounded-xl border bg-card p-3 shadow-sm transition hover:bg-accent">
              <div className="mb-1 inline-flex rounded-full bg-muted p-1.5"><Users size={14} /></div>
              <p className="font-medium">{t("cards.customers.title")}</p>
              <p className="text-xs text-muted-foreground">{t("cards.customers.description")}</p>
            </Link>
            <Link href="/sales-mobile/orders" className="rounded-xl border bg-card p-3 shadow-sm transition hover:bg-accent">
              <div className="mb-1 inline-flex rounded-full bg-muted p-1.5"><ListChecks size={14} /></div>
              <p className="font-medium">{t("cards.myOrders.title")}</p>
              <p className="text-xs text-muted-foreground">{t("cards.myOrders.description")}</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
