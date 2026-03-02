import Link from "next/link";

const dummyCustomers = [
  { id: "cust-1", name: "Toko Maju Jaya", address: "Sukabumi" },
  { id: "cust-2", name: "UD Sumber Rejeki", address: "Cianjur" },
];

export default function SalesCustomersPage() {
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">Customers</h1>
      <div className="space-y-2">
        {dummyCustomers.map((c) => (
          <Link key={c.id} href={`/sales/customers/${c.id}`} className="block rounded-lg border p-3 hover:bg-accent">
            <p className="font-medium">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.address}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
