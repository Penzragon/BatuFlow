import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function SalesCustomersPage() {
  const t = await getTranslations("salesMobile.customers");
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
    ? { deletedAt: null as Date | null, isActive: true }
    : { deletedAt: null as Date | null, isActive: true, salespersonId: userId };

  const customers = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      paymentTermsDays: true,
      updatedAt: true,
    },
    orderBy: [{ name: "asc" }],
    take: 100,
  });

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="text-xs text-muted-foreground">{t("assignedCount", { count: customers.length })}</p>
      </div>

      <div className="space-y-2">
        {customers.length === 0 ? (
          <div className="rounded-lg border p-3 text-sm text-muted-foreground">
            {t("emptyState")}
          </div>
        ) : (
          customers.map((c) => (
            <Link key={c.id} href={`/sales-mobile/customers/${c.id}`} className="block rounded-lg border p-3 hover:bg-accent">
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.address || "-"}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{c.phone || t("noPhone")}</span>
                <span>•</span>
                <span>{t("paymentTerms", { days: c.paymentTermsDays })}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
