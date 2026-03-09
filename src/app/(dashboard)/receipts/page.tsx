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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Receipt {
  id: string;
  receiptNumber: string;
  amount: number;
  description: string | null;
  source: string | null;
  receiptDate: string;
  paymentMethod: string;
  referenceNo: string | null;
  status: string;
  category: { id: string; name: string };
  submitter: { id: string; name: string };
  approver?: { id: string; name: string };
}

interface ReceiptCategory {
  id: string;
  name: string;
}

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "GIRO", label: "Giro" },
  { value: "CHECK", label: "Check" },
  { value: "OTHER", label: "Other" },
] as const;

const formatIDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

export default function ReceiptsPage() {
  const t = useTranslations("receipts");
  const tc = useTranslations("common");
  const router = useRouter();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [categories, setCategories] = useState<ReceiptCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    categoryId: "",
    amount: "",
    description: "",
    source: "",
    receiptDate: format(new Date(), "yyyy-MM-dd"),
    paymentMethod: "CASH",
    referenceNo: "",
  });

  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/receipts?page=1&pageSize=100");
      const json = await res.json();
      if (json.success) {
        setReceipts(json.data?.items ?? []);
      }
    } catch {
      toast.error("Failed to load receipts");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/receipt-categories?page=1&pageSize=100");
      const json = await res.json();
      if (json.success) {
        setCategories(json.data?.items ?? []);
      }
    } catch {
      toast.error("Failed to load categories");
    }
  }, []);

  useEffect(() => {
    fetchReceipts();
    fetchCategories();
  }, [fetchReceipts, fetchCategories]);

  function openCreateDialog() {
    setFormData({
      categoryId: "",
      amount: "",
      description: "",
      source: "",
      receiptDate: format(new Date(), "yyyy-MM-dd"),
      paymentMethod: "CASH",
      referenceNo: "",
    });
    setFormOpen(true);
  }

  async function handleCreate() {
    if (!formData.categoryId || !formData.amount) {
      toast.error("Please fill in category and amount");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: formData.categoryId,
          amount: parseFloat(formData.amount),
          description: formData.description?.trim() || undefined,
          source: formData.source?.trim() || undefined,
          receiptDate: formData.receiptDate,
          paymentMethod: formData.paymentMethod,
          referenceNo: formData.referenceNo?.trim() || null,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(t("createSuccess"));
        setFormOpen(false);
        fetchReceipts();
      } else {
        toast.error(json.error || "Failed to create receipt");
      }
    } catch {
      toast.error("Failed to create receipt");
    } finally {
      setSaving(false);
    }
  }

  const columns: ColumnDef<Receipt>[] = useMemo(
    () => [
      {
        accessorKey: "receiptNumber",
        header: t("receiptNumber"),
        cell: ({ row }) => (
          <button
            className="font-medium text-left hover:underline text-blue-600"
            onClick={() => router.push(`/receipts/${row.original.id}`)}
          >
            {row.getValue("receiptNumber")}
          </button>
        ),
      },
      {
        accessorKey: "receiptDate",
        header: t("date"),
        cell: ({ row }) => format(new Date(row.getValue("receiptDate")), "dd MMM yyyy"),
      },
      {
        accessorKey: "category",
        header: t("category"),
        cell: ({ row }) => row.original.category.name,
      },
      {
        accessorKey: "source",
        header: t("source"),
        cell: ({ row }) => row.original.source || "-",
      },
      {
        accessorKey: "amount",
        header: t("amount"),
        cell: ({ row }) => formatIDR.format(row.getValue("amount")),
      },
      {
        accessorKey: "submitter",
        header: t("submitter"),
        cell: ({ row }) => row.original.submitter.name,
      },
      {
        accessorKey: "status",
        header: t("status"),
        cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
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
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {t("createReceipt")}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={receipts}
        searchKey="receiptNumber"
        searchPlaceholder={`${tc("search")} ${t("title").toLowerCase()}...`}
        isLoading={loading}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("createReceipt")}</DialogTitle>
            <DialogDescription>{t("createReceiptDescription")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="receipt-category">{t("category")} *</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(val) => setFormData((prev) => ({ ...prev, categoryId: val }))}
              >
                <SelectTrigger id="receipt-category">
                  <SelectValue placeholder={t("selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {(categories ?? []).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="receipt-amount">{t("amount")} *</Label>
              <Input
                id="receipt-amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder={t("amountPlaceholder")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="receipt-source">{t("source")}</Label>
              <Input
                id="receipt-source"
                value={formData.source}
                onChange={(e) => setFormData((prev) => ({ ...prev, source: e.target.value }))}
                placeholder={t("sourcePlaceholder")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="receipt-description">{t("description")}</Label>
              <Textarea
                id="receipt-description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t("descriptionPlaceholder")}
                rows={3}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="receipt-date">{t("date")} *</Label>
                <Input
                  id="receipt-date"
                  type="date"
                  value={formData.receiptDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, receiptDate: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="receipt-payment">{t("paymentMethod")} *</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, paymentMethod: val }))}
                >
                  <SelectTrigger id="receipt-payment">
                    <SelectValue placeholder={t("selectPaymentMethod")} />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((pm) => (
                      <SelectItem key={pm.value} value={pm.value}>
                        {pm.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="receipt-ref">{t("referenceNo")}</Label>
              <Input
                id="receipt-ref"
                value={formData.referenceNo}
                onChange={(e) => setFormData((prev) => ({ ...prev, referenceNo: e.target.value }))}
                placeholder={t("referenceNoPlaceholder")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? tc("loading") : t("createReceipt")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
