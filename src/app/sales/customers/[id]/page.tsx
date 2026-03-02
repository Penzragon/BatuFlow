import Link from "next/link";

export default async function SalesCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">Customer Detail</h1>
      <p className="text-sm text-muted-foreground">Customer ID: {id}</p>

      <div className="grid grid-cols-1 gap-2">
        <Link href={`/sales/visits/new?customerId=${id}`} className="rounded-lg border p-3 hover:bg-accent">
          Start Visit Check-in
        </Link>
        <Link href={`/sales/orders/new?customerId=${id}`} className="rounded-lg border p-3 hover:bg-accent">
          Create New Order
        </Link>
      </div>
    </div>
  );
}
