"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";

interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  status: string;
  totalDebit: number;
  totalCredit: number;
  creator: { name: string };
  _count: { lines: number };
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);

export default function JournalEntriesPage() {
  const t = useTranslations("journalEntries");
  const router = useRouter();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/journal-entries?page=1&pageSize=100");
      const json = await res.json();
      if (json.success) setEntries(json.data?.items ?? []);
    } catch {
      toast.error("Failed to load journal entries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const columns: ColumnDef<JournalEntry>[] = useMemo(
    () => [
      {
        accessorKey: "entryNumber",
        header: t("entryNumber"),
        cell: ({ row }) => (
          <button
            className="font-medium text-blue-600 hover:underline"
            onClick={() =>
              router.push(`/finance/journal-entries/${row.original.id}`)
            }
          >
            {row.original.entryNumber}
          </button>
        ),
      },
      {
        accessorKey: "entryDate",
        header: t("entryDate"),
        cell: ({ row }) =>
          format(new Date(row.original.entryDate), "dd MMM yyyy"),
      },
      {
        accessorKey: "description",
        header: t("description"),
        cell: ({ row }) => (
          <span className="max-w-[200px] truncate block">
            {row.original.description || "-"}
          </span>
        ),
      },
      {
        accessorKey: "referenceType",
        id: "referenceType",
        header: t("referenceType"),
        cell: ({ row }) => row.original.referenceType ?? "Manual",
      },
      {
        accessorKey: "status",
        header: t("status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "totalDebit",
        header: t("totalDebit"),
        cell: ({ row }) => (
          <span className="text-right block">
            {formatCurrency(row.original.totalDebit)}
          </span>
        ),
      },
      {
        accessorKey: "totalCredit",
        header: t("totalCredit"),
        cell: ({ row }) => (
          <span className="text-right block">
            {formatCurrency(row.original.totalCredit)}
          </span>
        ),
      },
    ],
    [t, router]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={() => router.push("/finance/journal-entries/new")}>
            <Plus className="mr-2 h-4 w-4" />
            {t("createEntry")}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={entries}
        isLoading={loading}
        searchKey="entryNumber"
        searchPlaceholder={t("searchPlaceholder")}
      />
    </div>
  );
}
