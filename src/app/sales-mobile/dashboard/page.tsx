import Link from "next/link";

export default function SalesDashboardPage() {
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">Sales Dashboard</h1>
      <p className="text-sm text-muted-foreground">Welcome to Sales App v1. Start with visit check-in or create an order.</p>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/sales-mobile/visits/new" className="rounded-lg border p-3 hover:bg-accent">
          <p className="font-medium">New Check-in</p>
          <p className="text-xs text-muted-foreground">Photo + GPS + timestamp</p>
        </Link>
        <Link href="/sales-mobile/orders/new" className="rounded-lg border p-3 hover:bg-accent">
          <p className="font-medium">New Order</p>
          <p className="text-xs text-muted-foreground">Quick order entry</p>
        </Link>
        <Link href="/sales-mobile/customers" className="rounded-lg border p-3 hover:bg-accent">
          <p className="font-medium">Customers</p>
          <p className="text-xs text-muted-foreground">Browse assigned customers</p>
        </Link>
        <Link href="/sales-mobile/orders" className="rounded-lg border p-3 hover:bg-accent">
          <p className="font-medium">My Orders</p>
          <p className="text-xs text-muted-foreground">Track status</p>
        </Link>
      </div>
    </div>
  );
}
