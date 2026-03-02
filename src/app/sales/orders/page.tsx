import Link from "next/link";

const dummyOrders = [
  { id: "so-1", code: "SO-0001", status: "SUBMITTED" },
  { id: "so-2", code: "SO-0002", status: "APPROVED" },
];

export default function SalesOrdersPage() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">My Orders</h1>
        <Link href="/sales/orders/new" className="rounded-md border px-3 py-1 text-sm hover:bg-accent">
          New
        </Link>
      </div>
      <div className="space-y-2">
        {dummyOrders.map((o) => (
          <Link key={o.id} href={`/sales/orders/${o.id}`} className="block rounded-lg border p-3 hover:bg-accent">
            <p className="font-medium">{o.code}</p>
            <p className="text-xs text-muted-foreground">{o.status}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
