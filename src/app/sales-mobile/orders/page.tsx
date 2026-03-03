import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const statusClass: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  WAITING_APPROVAL: "bg-amber-100 text-amber-700",
  PARTIALLY_DELIVERED: "bg-indigo-100 text-indigo-700",
  FULLY_DELIVERED: "bg-green-100 text-green-700",
  CLOSED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default async function SalesOrdersPage() {
  const t = await getTranslations("salesMobile.orders");
  const locale = await getLocale();
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role;

  if (!userId || !role) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="text-sm text-red-600">{t("unauthorized")}</p>
      </div>
    );
  }

  const where = role === "ADMIN" || role === "MANAGER"
    ? { deletedAt: null as Date | null }
    : { deletedAt: null as Date | null, createdBy: userId };

  const orders = await prisma.salesOrder.findMany({
    where,
    select: {
      id: true,
      soNumber: true,
      status: true,
      grandTotal: true,
      createdAt: true,
      customer: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });

  const currency = "IDR";

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t("title")}</h1>
          <p className="text-xs text-muted-foreground">{t("recentCount", { count: orders.length })}</p>
        </div>
        <Link href="/sales-mobile/orders/new" className="rounded-md border px-3 py-1 text-sm hover:bg-accent">
          {t("newButton")}
        </Link>
      </div>

      <div className="space-y-2">
        {orders.length === 0 ? (
          <div className="rounded-lg border p-3 text-sm text-muted-foreground">
            {t("emptyState")}
          </div>
        ) : (
          orders.map((o) => (
            <Link key={o.id} href={`/sales-mobile/orders/${o.id}`} className="block rounded-lg border p-3 hover:bg-accent">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{o.soNumber}</p>
                  <p className="text-xs text-muted-foreground">{o.customer.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(o.createdAt), "dd MMM yyyy HH:mm")}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass[o.status] ?? "bg-slate-100 text-slate-700"}`}>
                    {t(`status.${o.status}`)}
                  </span>
                  <p className="mt-2 text-xs font-medium">
                    {new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: locale === "id" ? 0 : 2 }).format(Number(o.grandTotal))}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
