"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  status: string;
  grandTotal: number;
  amountPaid: number;
  dueDate: string;
  createdAt: string;
  customer: { id: string; name: string };
  deliveryOrder: { id: string; doNumber: string; salesOrder: { id: string; soNumber: string } };
}

export default function InvoicesPage() {
  const t = useTranslations("invoices");
  const router = useRouter();

  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/invoices?pageSize=100");
      const json = await res.json();
      if (json.success) setInvoices(json.data.items);
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const columns: ColumnDef<InvoiceItem>[] = useMemo(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: t("invoiceNumber"),
        cell: ({ row }) => (
          <button
            className="font-medium text-blue-600 hover:underline"
            onClick={() => router.push(`/sales/invoices/${row.original.id}`)}
          >
            {row.original.invoiceNumber}
          </button>
        ),
      },
      {
        id: "customer",
        header: t("customer"),
        cell: ({ row }) => row.original.customer?.name ?? "-",
      },
      {
        id: "soNumber",
        header: "SO",
        cell: ({ row }) => row.original.deliveryOrder?.salesOrder?.soNumber ?? "-",
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
        id: "balance",
        header: t("balance"),
        cell: ({ row }) => {
          const balance = row.original.grandTotal - row.original.amountPaid;
          return (
            <span className={balance > 0 ? "text-red-600 font-medium" : "text-green-600"}>
              {formatCurrency(balance)}
            </span>
          );
        },
      },
      {
        accessorKey: "dueDate",
        header: t("dueDate"),
        cell: ({ row }) => {
          const due = new Date(row.original.dueDate);
          const isOverdue = due < new Date() && !["PAID", "DRAFT"].includes(row.original.status);
          return (
            <span className={isOverdue ? "text-red-600 font-medium" : ""}>
              {format(due, "dd MMM yyyy")}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/sales/invoices/${row.original.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
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
          <Button variant="outline" onClick={() => router.push("/sales/invoices/aging")}>
            <BarChart3 className="mr-2 h-4 w-4" />
            {t("agingReport")}
          </Button>
        }
      />
      <DataTable columns={columns} data={invoices} isLoading={loading} />
    </div>
  );
}
