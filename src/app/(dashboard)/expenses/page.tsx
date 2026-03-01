"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil } from "lucide-react";
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

interface Expense {
  id: string;
  expenseNumber: string;
  amount: number;
  description: string;
  expenseDate: string;
  paymentMethod: string;
  referenceNo: string | null;
  status: string;
  category: { id: string; name: string };
  submitter: { id: string; name: string };
  approver?: { id: string; name: string };
  createdAt: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
  coaAccount?: { code: string; name: string };
}

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "GIRO", label: "Giro" },
  { value: "CHECK", label: "Check" },
  { value: "OTHER", label: "Other" },
] as const;

/** Formats a number as Indonesian Rupiah currency string. */
const formatIDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

/**
 * Expense list page with search, filtering, and a create-expense dialog.
 * Displays all expenses in a paginated data table with category,
 * amount, status, and submitter information.
 */
export default function ExpensesPage() {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const router = useRouter();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    categoryId: "",
    amount: "",
    description: "",
    expenseDate: format(new Date(), "yyyy-MM-dd"),
    paymentMethod: "CASH",
    referenceNo: "",
  });

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/expenses?page=1&pageSize=100");
      const json = await res.json();
      if (json.success) {
        setExpenses(json.data?.items ?? []);
      }
    } catch {
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/expense-categories?page=1&pageSize=100");
      const json = await res.json();
      if (json.success) {
        setCategories(json.data?.items ?? []);
      }
    } catch {
      toast.error("Failed to load categories");
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
  }, [fetchExpenses, fetchCategories]);

  function openCreateDialog() {
    setFormData({
      categoryId: "",
      amount: "",
      description: "",
      expenseDate: format(new Date(), "yyyy-MM-dd"),
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
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: formData.categoryId,
          amount: parseFloat(formData.amount),
          description: formData.description?.trim() || undefined,
          expenseDate: formData.expenseDate,
          paymentMethod: formData.paymentMethod,
          referenceNo: formData.referenceNo?.trim() || null,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(t("createSuccess"));
        setFormOpen(false);
        fetchExpenses();
      } else {
        toast.error(json.error || "Failed to create expense");
      }
    } catch {
      toast.error("Failed to create expense");
    } finally {
      setSaving(false);
    }
  }

  const columns: ColumnDef<Expense>[] = useMemo(
    () => [
      {
        accessorKey: "expenseNumber",
        header: t("expenseNumber"),
        cell: ({ row }) => (
          <button
            className="font-medium text-left hover:underline text-blue-600"
            onClick={() => router.push(`/expenses/${row.original.id}`)}
          >
            {row.getValue("expenseNumber")}
          </button>
        ),
      },
      {
        accessorKey: "expenseDate",
        header: t("date"),
        cell: ({ row }) =>
          format(new Date(row.getValue("expenseDate")), "dd MMM yyyy"),
      },
      {
        accessorKey: "category",
        header: t("category"),
        cell: ({ row }) => row.original.category.name,
      },
      {
        accessorKey: "amount",
        header: t("amount"),
        cell: ({ row }) => formatIDR.format(row.getValue("amount")),
      },
      {
        accessorKey: "paymentMethod",
        header: t("paymentMethod"),
        cell: ({ row }) => row.getValue("paymentMethod"),
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
            {t("createExpense")}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={expenses}
        searchKey="expenseNumber"
        searchPlaceholder={`${tc("search")} ${t("title").toLowerCase()}...`}
        isLoading={loading}
      />

      {/* Create Expense Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("createExpense")}</DialogTitle>
            <DialogDescription>{t("createExpenseDescription")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="expense-category">{t("category")} *</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(val) =>
                  setFormData((prev) => ({ ...prev, categoryId: val }))
                }
              >
                <SelectTrigger id="expense-category">
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
              <Label htmlFor="expense-amount">{t("amount")} *</Label>
              <Input
                id="expense-amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, amount: e.target.value }))
                }
                placeholder={t("amountPlaceholder")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="expense-description">{t("description")}</Label>
              <Textarea
                id="expense-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder={t("descriptionPlaceholder")}
                rows={3}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="expense-date">{t("date")} *</Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={formData.expenseDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      expenseDate: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="expense-payment">{t("paymentMethod")} *</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(val) =>
                    setFormData((prev) => ({ ...prev, paymentMethod: val }))
                  }
                >
                <SelectTrigger id="expense-payment">
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
              <Label htmlFor="expense-ref">{t("referenceNo")}</Label>
              <Input
                id="expense-ref"
                value={formData.referenceNo}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    referenceNo: e.target.value,
                  }))
                }
                placeholder={t("referenceNoPlaceholder")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              {tc("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? tc("loading") : t("createExpense")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
