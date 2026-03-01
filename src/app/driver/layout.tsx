import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import DriverMobileLayout from "./driver-mobile-layout";

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "DRIVER" && session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    redirect("/dashboard");
  }

  return (
    <DriverMobileLayout session={session}>
      {children}
    </DriverMobileLayout>
  );
}
