import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { format } from "date-fns";

import { auth } from "@/lib/auth";
import { SalesOrderService } from "@/services/sales-order.service";

const statusFlow = [
  "DRAFT",
  "WAITING_APPROVAL",
  "CONFIRMED",
  "PARTIALLY_DELIVERED",
  "FULLY_DELIVERED",
  "CLOSED",
] as const;

const statusClass: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  WAITING_APPROVAL: "bg-amber-100 text-amber-700",
  PARTIALLY_DELIVERED: "bg-indigo-100 text-indigo-700",
  FULLY_DELIVERED: "bg-green-100 text-green-700",
  CLOSED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

type StatusTimestamp = {
  key: "statusUpdatedAt" | "approvedAt" | "rejectedAt" | "latestDeliveryOrderAt";
  value: Date;
};

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("salesMobile.orders.detail");
  const ts = await getTranslations("salesMobile.orders.status");
  const locale = await getLocale();
  const { id } = await params;

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

  let so: Awaited<ReturnType<typeof SalesOrderService.getSO>>;
  try {
    so = await SalesOrderService.getSO(id, { id: userId, role });
  } catch {
    notFound();
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: locale === "id" ? 0 : 2,
    }).format(Number(value));

  const formatDateTime = (value: Date | string) => format(new Date(value), "dd MMM yyyy HH:mm");

  const statusIndex = statusFlow.indexOf(so.status as (typeof statusFlow)[number]);

  const latestDeliveryOrder = so.deliveryOrders[0];

  const statusTimestamp: StatusTimestamp | null = (() => {
    if (so.status === "CONFIRMED" && so.approvedAt) {
      return { key: "approvedAt", value: so.approvedAt };
    }

    if (so.status === "DRAFT" && so.rejectedAt) {
      return { key: "rejectedAt", value: so.rejectedAt };
    }

    if (["PARTIALLY_DELIVERED", "FULLY_DELIVERED", "CLOSED"].includes(so.status) && latestDeliveryOrder?.createdAt) {
      return { key: "latestDeliveryOrderAt", value: latestDeliveryOrder.createdAt };
    }

    if (so.updatedAt) {
      return { key: "statusUpdatedAt", value: so.updatedAt };
    }

    return null;
  })();

  return (
    <div className="space-y-4 p-4 pb-8">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="text-xs text-muted-foreground">{t("orderId", { id: so.id })}</p>
      </div>

      <div className="rounded-lg border p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <p className="text-base font-semibold leading-tight">{so.soNumber}</p>
            <p className="text-sm text-muted-foreground">{so.customer.name}</p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass[so.status] ?? "bg-slate-100 text-slate-700"}`}
          >
            {ts(so.status)}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 rounded-md bg-muted/35 p-2.5 text-xs">
          <div>
            <p className="text-muted-foreground">{t("createdAt")}</p>
            <p className="mt-0.5 font-medium">{formatDateTime(so.createdAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("createdBy")}</p>
            <p className="mt-0.5 font-medium">{so.creator.name}</p>
          </div>
        </div>

        {statusTimestamp && (
          <div className="mt-2 rounded-md border border-dashed bg-muted/20 p-2 text-xs">
            <p className="text-muted-foreground">{t("statusTimestampHint")}</p>
            <p className="mt-1 font-medium">
              {t(statusTimestamp.key)}: {formatDateTime(statusTimestamp.value)}
            </p>
          </div>
        )}

        <div className="mt-3 rounded-md bg-muted/40 p-2.5 text-xs">
          <p className="text-muted-foreground">{t("notes")}</p>
          <p className="mt-1 leading-relaxed">{so.notes?.trim() || t("emptyNotes")}</p>
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <p className="mb-2 text-sm font-semibold">{t("timelineTitle")}</p>
        <div className="space-y-2">
          {statusFlow.map((status, index) => {
            const reached = so.status === "CANCELLED" ? index === 0 : statusIndex >= index;
            const isCurrent = so.status === status;
            return (
              <div key={status} className="flex items-center gap-2 text-xs">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isCurrent ? "bg-primary" : reached ? "bg-emerald-500" : "bg-muted"
                  }`}
                />
                <span className={reached ? "font-medium" : "text-muted-foreground"}>{ts(status)}</span>
              </div>
            );
          })}
          {so.status === "CANCELLED" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="font-medium text-red-700">{ts("CANCELLED")}</span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <p className="mb-2 text-sm font-semibold">{t("lineItemsTitle")}</p>
        <div className="space-y-2.5">
          {so.lines.map((line) => (
            <div key={line.id} className="rounded-md border p-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{line.product.name}</p>
                  <p className="text-muted-foreground">{line.product.sku}</p>
                </div>
                <p className="text-sm font-semibold">{formatCurrency(Number(line.lineTotal))}</p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-muted-foreground">
                <p>
                  {t("qty")}: <span className="font-medium text-foreground">{line.qty} {line.uom}</span>
                </p>
                <p>
                  {t("unitPrice")}: <span className="font-medium text-foreground">{formatCurrency(Number(line.unitPrice))}</span>
                </p>
                <p>
                  {t("discount")}: <span className="font-medium text-foreground">{Number(line.discountPercent).toFixed(2)}%</span>
                </p>
                <p>
                  {t("discountAmount")}: <span className="font-medium text-foreground">{formatCurrency(Number(line.discountAmount))}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-3.5 text-sm">
        <p className="mb-3 font-semibold">{t("summaryTitle")}</p>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("subtotal")}</span>
            <span className="font-medium text-foreground">{formatCurrency(Number(so.subtotal))}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("discountTotal")}</span>
            <span className="font-medium text-red-600">-{formatCurrency(Number(so.discountTotal))}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("ppn")}</span>
            <span className="font-medium text-foreground">{formatCurrency(Number(so.ppnAmount))}</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t pt-2.5 text-sm font-semibold">
            <span>{t("grandTotal")}</span>
            <span className="text-base">{formatCurrency(Number(so.grandTotal))}</span>
          </div>
        </div>
      </div>

      <Link href="/sales-mobile/orders" className="inline-flex rounded-md border px-3 py-2 text-sm hover:bg-accent">
        {t("backToOrders")}
      </Link>
    </div>
  );
}
