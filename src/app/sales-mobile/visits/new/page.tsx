import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SalesVisitCheckInForm from "./sales-visit-checkin-form";

export default async function SalesVisitCheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const t = await getTranslations("salesMobile.visits");
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role;
  const sp = await searchParams;

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
    select: { id: true, name: true, address: true },
    orderBy: [{ name: "asc" }],
    take: 200,
  });

  return (
    <SalesVisitCheckInForm
      customers={customers}
      initialCustomerId={sp.customerId}
    />
  );
}
