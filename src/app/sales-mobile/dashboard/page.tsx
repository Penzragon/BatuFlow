import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function SalesDashboardPage() {
  const t = await getTranslations("salesMobile.dashboard");

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/sales-mobile/visits/new" className="rounded-lg border p-3 hover:bg-accent">
          <p className="font-medium">{t("cards.newCheckIn.title")}</p>
          <p className="text-xs text-muted-foreground">{t("cards.newCheckIn.description")}</p>
        </Link>
        <Link href="/sales-mobile/orders/new" className="rounded-lg border p-3 hover:bg-accent">
          <p className="font-medium">{t("cards.newOrder.title")}</p>
          <p className="text-xs text-muted-foreground">{t("cards.newOrder.description")}</p>
        </Link>
        <Link href="/sales-mobile/customers" className="rounded-lg border p-3 hover:bg-accent">
          <p className="font-medium">{t("cards.customers.title")}</p>
          <p className="text-xs text-muted-foreground">{t("cards.customers.description")}</p>
        </Link>
        <Link href="/sales-mobile/orders" className="rounded-lg border p-3 hover:bg-accent">
          <p className="font-medium">{t("cards.myOrders.title")}</p>
          <p className="text-xs text-muted-foreground">{t("cards.myOrders.description")}</p>
        </Link>
      </div>
    </div>
  );
}
