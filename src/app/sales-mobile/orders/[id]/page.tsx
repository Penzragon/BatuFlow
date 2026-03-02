import { getTranslations } from "next-intl/server";

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("salesMobile.orders.detail");
  const { id } = await params;

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("orderId", { id })}</p>
    </div>
  );
}
