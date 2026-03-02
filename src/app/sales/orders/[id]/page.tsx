export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">Order Detail</h1>
      <p className="text-sm text-muted-foreground">Order ID: {id}</p>
    </div>
  );
}
