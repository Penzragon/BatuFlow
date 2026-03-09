import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function CashflowTransactionsPage() {
  const t = useTranslations("nav");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("transactions")}
        description="Navigate to cashflow transactions modules"
      />

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm">
            <div><Link href="/expenses" className="text-blue-600 underline">{t("allExpenses")}</Link></div>
            <div><Link href="/receipts" className="text-blue-600 underline">{t("allReceipts")}</Link></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
