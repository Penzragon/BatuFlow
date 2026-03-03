import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SalesVisitCheckoutForm from "./sales-visit-checkout-form";

export default async function SalesVisitCheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("salesMobile.visits.checkout");
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role;
  const { id } = await params;

  if (!userId || !role) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="text-sm text-red-600">{t("unauthorized")}</p>
      </div>
    );
  }

  const visit = await prisma.customerVisit.findUnique({
    where: { id },
    include: {
      customer: {
        select: { id: true, name: true, address: true },
      },
    },
  });

  if (!visit) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="text-sm text-red-600">{t("notFound")}</p>
      </div>
    );
  }

  const isOwner = visit.salespersonId === userId;
  const isPrivileged = role === "ADMIN" || role === "MANAGER";
  if (!isOwner && !isPrivileged) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="text-sm text-red-600">{t("unauthorized")}</p>
      </div>
    );
  }

  return (
    <SalesVisitCheckoutForm
      visit={{
        id: visit.id,
        customerName: visit.customer?.name ?? "-",
        customerAddress: visit.customer?.address ?? null,
        checkInAt: visit.checkInAt.toISOString(),
        status: visit.status,
        checkoutAt: visit.checkoutAt?.toISOString() ?? null,
      }}
    />
  );
}
