import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, ClipboardCheck, ListChecks, LogOut, ShoppingCart, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SalesDashboardKpi from "./sales-dashboard-kpi";

export default async function SalesDashboardPage() {
  const t = await getTranslations("salesMobile.dashboard");
  const session = await auth();
  const userId = session?.user?.id;

  const activeVisit = userId
    ? await prisma.customerVisit.findFirst({
        where: {
          salespersonId: userId,
          status: "OPEN",
          checkoutAt: null,
        },
        orderBy: { checkInAt: "desc" },
        include: {
          customer: {
            select: { id: true, name: true, address: true },
          },
        },
      })
    : null;

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <SalesDashboardKpi />

      {activeVisit && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{t("activeVisit.badge")}</p>
          <p className="mt-1 font-medium text-emerald-900">{activeVisit.customer?.name ?? "-"}</p>
          {activeVisit.customer?.address && (
            <p className="text-xs text-emerald-800/90">{activeVisit.customer.address}</p>
          )}
          <p className="mt-1 text-xs text-emerald-800/90">{t("activeVisit.checkedInAt", { at: activeVisit.checkInAt.toLocaleString() })}</p>
          <Link
            href={`/sales-mobile/visits/${activeVisit.id}/checkout`}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            <LogOut size={14} />
            {t("activeVisit.checkoutNow")}
          </Link>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("quickActions")}</p>
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
