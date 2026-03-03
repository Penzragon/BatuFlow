import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function SalesCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("salesMobile.customers.detail");
  const { id } = await params;

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("customerId", { id })}</p>

      <div className="grid grid-cols-1 gap-2">
        <Link href={`/sales-mobile/visits/new?customerId=${id}`} className="rounded-lg border p-3 hover:bg-accent">
          {t("startCheckIn")}
        </Link>
        <Link href={`/sales-mobile/orders/new?customerId=${id}`} className="rounded-lg border p-3 hover:bg-accent">
          {t("createOrder")}
        </Link>
      </div>
    </div>
  );
}
