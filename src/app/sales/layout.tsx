import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import SalesMobileLayout from "./sales-mobile-layout";

export default async function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role !== "STAFF" &&
    session.user.role !== "ADMIN" &&
    session.user.role !== "MANAGER"
  ) {
    redirect("/dashboard");
  }

  return <SalesMobileLayout session={session}>{children}</SalesMobileLayout>;
}
