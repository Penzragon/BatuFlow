"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";

interface SOItem {
  id: string;
  soNumber: string;
  status: string;
  grandTotal: number;
  createdAt: string;
  customer: { id: string; name: string };
  creator: { id: string; name: string };
  _count: { lines: number; deliveryOrders: number };
}

export default function SalesOrdersPage() {
  const t = useTranslations("salesOrders");
  const router = useRouter();

  const [orders, setOrders] = useState<SOItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sales-orders?pageSize=100");
      const json = await res.json();
      if (json.success) setOrders(json.data.items);
    } catch {
      toast.error("Failed to load sales orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const columns: ColumnDef<SOItem>[] = useMemo(
    () => [
      {
        accessorKey: "soNumber",
        header: t("soNumber"),
        cell: ({ row }) => (
          <button
            className="font-medium text-blue-600 hover:underline"
            onClick={() => router.push(`/sales/orders/${row.original.id}`)}
          >
            {row.original.soNumber}
          </button>
        ),
      },
      {
        accessorKey: "customer.name",
        header: t("customer"),
        cell: ({ row }) => row.original.customer?.name ?? "-",
      },
      {
        accessorKey: "status",
        header: t("status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "grandTotal",
        header: t("grandTotal"),
        cell: ({ row }) => formatCurrency(row.original.grandTotal),
      },
      {
        accessorKey: "_count.lines",
        header: "Items",
        cell: ({ row }) => row.original._count?.lines ?? 0,
      },
      {
        accessorKey: "creator.name",
        header: "Created By",
        cell: ({ row }) => row.original.creator?.name ?? "-",
      },
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => format(new Date(row.original.createdAt), "dd MMM yyyy"),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/sales/orders/${row.original.id}`)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [t, router]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <Button onClick={() => router.push("/sales/orders/new")}>
            <Plus className="mr-2 h-4 w-4" />
            {t("createOrder")}
          </Button>
        }
      />
      <DataTable columns={columns} data={orders} isLoading={loading} />
    </div>
  );
}
