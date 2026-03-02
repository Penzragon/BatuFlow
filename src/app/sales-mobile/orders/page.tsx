import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const statusClass: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  WAITING_APPROVAL: "bg-amber-100 text-amber-700",
  PARTIALLY_DELIVERED: "bg-indigo-100 text-indigo-700",
  FULLY_DELIVERED: "bg-green-100 text-green-700",
  CLOSED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default async function SalesOrdersPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role;

  if (!userId || !role) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-lg font-semibold">My Orders</h1>
        <p className="text-sm text-red-600">Unauthorized</p>
      </div>
    );
  }

  const where = role === "ADMIN" || role === "MANAGER"
    ? { deletedAt: null as Date | null }
    : { deletedAt: null as Date | null, createdBy: userId };

  const orders = await prisma.salesOrder.findMany({
    where,
    select: {
      id: true,
      soNumber: true,
      status: true,
      grandTotal: true,
      createdAt: true,
      customer: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">My Orders</h1>
          <p className="text-xs text-muted-foreground">Recent orders: {orders.length}</p>
        </div>
        <Link href="/sales-mobile/orders/new" className="rounded-md border px-3 py-1 text-sm hover:bg-accent">
          New
        </Link>
      </div>

      <div className="space-y-2">
        {orders.length === 0 ? (
          <div className="rounded-lg border p-3 text-sm text-muted-foreground">
            No orders yet.
          </div>
        ) : (
          orders.map((o) => (
            <Link key={o.id} href={`/sales/orders/${o.id}`} className="block rounded-lg border p-3 hover:bg-accent">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{o.soNumber}</p>
                  <p className="text-xs text-muted-foreground">{o.customer.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass[o.status] ?? "bg-slate-100 text-slate-700"}`}>
                    {o.status.replaceAll("_", " ")}
                  </span>
                  <p className="mt-2 text-xs font-medium">
                    Rp {o.grandTotal.toLocaleString("id-ID")}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
