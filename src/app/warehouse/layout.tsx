import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import WarehouseMobileLayout from "./warehouse-mobile-layout";

export default async function WarehouseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["WAREHOUSE_STAFF", "ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  return (
    <WarehouseMobileLayout session={session}>
      {children}
    </WarehouseMobileLayout>
  );
}
