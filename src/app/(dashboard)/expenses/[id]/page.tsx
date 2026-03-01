"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Send, CheckCircle, XCircle, FileText } from "lucide-react";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

interface ExpenseDetail {
  id: string;
  expenseNumber: string;
  amount: number;
  description: string;
  expenseDate: string;
  paymentMethod: string;
  referenceNo: string | null;
  status: string;
  category: {
    name: string;
    coaAccount?: { code: string; name: string };
  };
  submitter: { name: string; email: string };
  approver?: { name: string };
  approvedAt: string | null;
  rejectionReason: string | null;
  journalEntry?: { id: string; entryNumber: string };
}

/** Formats a number as Indonesian Rupiah currency string. */
const formatIDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

/**
 * Expense detail page showing full expense information, status workflow,
 * and action buttons (submit, approve, reject) based on current status.
 */
export default function ExpenseDetailPage() {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const fetchExpense = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/expenses/${id}`);
      const json = await res.json();
      if (json.success) {
        setExpense(json.data);
      } else {
        toast.error(json.error || "Failed to load expense");
      }
    } catch {
      toast.error("Failed to load expense");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchExpense();
  }, [fetchExpense]);

  async function handleSubmit() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/expenses/${id}/submit`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success(t("submitSuccess"));
        fetchExpense();
      } else {
        toast.error(json.error || "Failed to submit expense");
      }
    } catch {
      toast.error("Failed to submit expense");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/expenses/${id}/approve`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t("approveSuccess"));
        fetchExpense();
      } else {
        toast.error(json.error || "Failed to approve expense");
      }
    } catch {
      toast.error("Failed to approve expense");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/expenses/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t("rejectSuccess"));
        setRejectOpen(false);
        setRejectReason("");
        fetchExpense();
      } else {
        toast.error(json.error || "Failed to reject expense");
      }
    } catch {
      toast.error("Failed to reject expense");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("notFound")}
          actions={
            <Button variant="outline" onClick={() => router.push("/expenses")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tc("back")}
            </Button>
          }
        />
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">
              {t("expenseNotFound")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("expense")} ${expense.expenseNumber}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/expenses")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tc("back")}
            </Button>

            {expense.status === "DRAFT" && (
              <Button onClick={handleSubmit} disabled={actionLoading}>
                <Send className="mr-2 h-4 w-4" />
                {t("submitForApproval")}
              </Button>
            )}

            {expense.status === "SUBMITTED" && (
              <>
                <Button onClick={handleApprove} disabled={actionLoading}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {t("approve")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setRejectOpen(true)}
                  disabled={actionLoading}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {t("reject")}
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Main Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t("expenseDetails")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4">
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-sm font-medium text-muted-foreground">
                  {t("expenseNumber")}
                </dt>
                <dd className="col-span-2 text-sm">{expense.expenseNumber}</dd>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-sm font-medium text-muted-foreground">
                  {t("date")}
                </dt>
                <dd className="col-span-2 text-sm">
                  {format(new Date(expense.expenseDate), "dd MMM yyyy")}
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-sm font-medium text-muted-foreground">
                  {t("category")}
                </dt>
                <dd className="col-span-2 text-sm">
                  {expense.category.name}
                  {expense.category.coaAccount && (
                    <span className="ml-2 text-muted-foreground">
                      ({expense.category.coaAccount.code} —{" "}
                      {expense.category.coaAccount.name})
                    </span>
                  )}
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-sm font-medium text-muted-foreground">
                  {t("amount")}
                </dt>
                <dd className="col-span-2 text-sm font-semibold">
                  {formatIDR.format(expense.amount)}
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-sm font-medium text-muted-foreground">
                  {t("paymentMethod")}
                </dt>
                <dd className="col-span-2 text-sm">{expense.paymentMethod}</dd>
              </div>
              {expense.referenceNo && (
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-sm font-medium text-muted-foreground">
                    {t("referenceNo")}
                  </dt>
                  <dd className="col-span-2 text-sm">{expense.referenceNo}</dd>
                </div>
              )}
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-sm font-medium text-muted-foreground">
                  {t("description")}
                </dt>
                <dd className="col-span-2 text-sm whitespace-pre-wrap">
                  {expense.description}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Status & Workflow Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t("statusAndApproval")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4">
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-sm font-medium text-muted-foreground">
                  {t("status")}
                </dt>
                <dd className="col-span-2">
                  <StatusBadge status={expense.status} />
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-sm font-medium text-muted-foreground">
                  {t("submitter")}
                </dt>
                <dd className="col-span-2 text-sm">
                  <div>{expense.submitter.name}</div>
                  <div className="text-muted-foreground">
                    {expense.submitter.email}
                  </div>
                </dd>
              </div>
              {expense.approver && (
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-sm font-medium text-muted-foreground">
                    {t("approver")}
                  </dt>
                  <dd className="col-span-2 text-sm">
                    <div>{expense.approver.name}</div>
                    {expense.approvedAt && (
                      <div className="text-muted-foreground">
                        {format(
                          new Date(expense.approvedAt),
                          "dd MMM yyyy HH:mm"
                        )}
                      </div>
                    )}
                  </dd>
                </div>
              )}
              {expense.status === "REJECTED" && expense.rejectionReason && (
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-sm font-medium text-muted-foreground">
                    {t("rejectionReason")}
                  </dt>
                  <dd className="col-span-2 text-sm text-red-600">
                    {expense.rejectionReason}
                  </dd>
                </div>
              )}
              {expense.status === "APPROVED" && expense.journalEntry && (
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-sm font-medium text-muted-foreground">
                    {t("journalEntry")}
                  </dt>
                  <dd className="col-span-2">
                    <Button
                      variant="link"
                      className="h-auto p-0 text-blue-600"
                      onClick={() =>
                        router.push(
                          `/finance/journal-entries/${expense.journalEntry!.id}`
                        )
                      }
                    >
                      <FileText className="mr-1 h-4 w-4" />
                      {expense.journalEntry.entryNumber}
                    </Button>
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectExpense")}</DialogTitle>
            <DialogDescription>{t("rejectDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reject-reason">{t("rejectionReason")} *</Label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("rejectionReasonPlaceholder")}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={actionLoading}
            >
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading}
            >
              {actionLoading ? tc("loading") : t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
