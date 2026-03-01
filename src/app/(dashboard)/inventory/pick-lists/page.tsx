"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ColumnDef } from "@tanstack/react-table";

interface PickListItem {
  id: string;
  pickListNumber: string;
  status: string;
  createdAt: string;
  deliveryOrder: {
    id: string;
    doNumber: string;
    salesOrder: { customer: { name: string } };
  };
  assignee: { id: string; name: string } | null;
  _count: { lines: number };
}

export default function PickListsPage() {
  const t = useTranslations("pickLists");
  const router = useRouter();
  const [items, setItems] = useState<PickListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPickLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pick-lists?pageSize=200");
      const data = await res.json();
      if (data.success) setItems(data.data.items);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPickLists(); }, [fetchPickLists]);

  const columns: ColumnDef<PickListItem>[] = [
    {
      accessorKey: "pickListNumber",
      header: t("pickListNumber"),
      cell: ({ row }) => (
        <button className="font-mono text-sm font-medium text-primary underline" onClick={() => router.push(`/inventory/pick-lists/${row.original.id}`)}>
          {row.original.pickListNumber}
        </button>
      ),
    },
    { accessorKey: "deliveryOrder.doNumber", header: t("deliveryOrder"), cell: ({ row }) => row.original.deliveryOrder.doNumber },
    { accessorKey: "customer", header: t("customer"), cell: ({ row }) => row.original.deliveryOrder.salesOrder.customer.name },
    { accessorKey: "status", header: t("status"), cell: ({ row }) => <StatusBadge status={row.original.status.toLowerCase().replace(/_/g, "_")} /> },
    { accessorKey: "assignee", header: t("assignedTo"), cell: ({ row }) => row.original.assignee?.name ?? "—" },
    { accessorKey: "_count.lines", header: "Items", cell: ({ row }) => row.original._count.lines },
    { accessorKey: "createdAt", header: "Date", cell: ({ row }) => format(new Date(row.original.createdAt), "dd/MM/yyyy") },
  ];

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-6">
        <DataTable columns={columns} data={items} isLoading={loading} searchKey="pickListNumber" />
      </div>
    </>
  );
}
