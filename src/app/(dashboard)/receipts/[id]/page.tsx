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

interface ReceiptDetail {
  id: string;
  receiptNumber: string;
  amount: number;
  description: string | null;
  source: string | null;
  receiptDate: string;
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

const formatIDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

export default function ReceiptDetailPage() {
  const t = useTranslations("receipts");
  const tc = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const fetchReceipt = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/receipts/${id}`);
      const json = await res.json();
      if (json.success) {
        setReceipt(json.data);
      } else {
        toast.error(json.error || "Failed to load receipt");
      }
    } catch {
      toast.error("Failed to load receipt");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  async function handleSubmit() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/receipts/${id}/submit`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success(t("submitSuccess"));
        fetchReceipt();
      } else {
        toast.error(json.error || "Failed to submit receipt");
      }
    } catch {
      toast.error("Failed to submit receipt");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/receipts/${id}/approve`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t("approveSuccess"));
        fetchReceipt();
      } else {
        toast.error(json.error || "Failed to approve receipt");
      }
    } catch {
      toast.error("Failed to approve receipt");
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
      const res = await fetch(`/api/receipts/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t("rejectSuccess"));
        setRejectOpen(false);
        setRejectReason("");
        fetchReceipt();
      } else {
        toast.error(json.error || "Failed to reject receipt");
      }
    } catch {
      toast.error("Failed to reject receipt");
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

  if (!receipt) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("notFound")}
          actions={
            <Button variant="outline" onClick={() => router.push("/receipts")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tc("back")}
            </Button>
          }
        />
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">{t("receiptNotFound")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("receipt")} ${receipt.receiptNumber}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/receipts")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tc("back")}
            </Button>

            {receipt.status === "DRAFT" && (
              <Button onClick={handleSubmit} disabled={actionLoading}>
                <Send className="mr-2 h-4 w-4" />
                {t("submitForApproval")}
              </Button>
            )}

            {receipt.status === "SUBMITTED" && (
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
        <Card>
          <CardHeader>
            <CardTitle>{t("receiptDetails")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4">
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-sm font-medium text-muted-foreground">{t("receiptNumber")}</dt>
                <dd className="col-span-2 text-sm">{receipt.receiptNumber}</dd>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-sm font-medium text-muted-foreground">{t("date")}</dt>
                <dd className="col-span-2 text-sm">{format(new Date(receipt.receiptDate), "dd MMM yyyy")}</dd>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-sm font-medium text-muted-foreground">{t("category")}</dt>
                <dd className="col-span-2 text-sm">
                  {receipt.category.name}
                  {receipt.category.coaAccount && (
                    <span className="ml-2 text-muted-foreground">
                      ({receipt.category.coaAccount.code} — {receipt.category.coaAccount.name})
                    </span>
                  )}
                </dd>
              </div>
              {receipt.source && (
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-sm font-medium text-muted-foreground">{t("source")}</dt>
                  <dd className="col-span-2 text-sm">{receipt.source}</dd>
                </div>
              )}
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-sm font-medium text-muted-foreground">{t("amount")}</dt>
                <dd className="col-span-2 text-sm font-semibold">{formatIDR.format(receipt.amount)}</dd>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-sm font-medium text-muted-foreground">{t("paymentMethod")}</dt>
                <dd className="col-span-2 text-sm">{receipt.paymentMethod}</dd>
              </div>
              {receipt.referenceNo && (
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-sm font-medium text-muted-foreground">{t("referenceNo")}</dt>
                  <dd className="col-span-2 text-sm">{receipt.referenceNo}</dd>
                </div>
              )}
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-sm font-medium text-muted-foreground">{t("description")}</dt>
                <dd className="col-span-2 text-sm whitespace-pre-wrap">{receipt.description || "-"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("statusAndApproval")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4">
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-sm font-medium text-muted-foreground">{t("status")}</dt>
                <dd className="col-span-2">
                  <StatusBadge status={receipt.status} />
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-sm font-medium text-muted-foreground">{t("submitter")}</dt>
                <dd className="col-span-2 text-sm">
                  <div>{receipt.submitter.name}</div>
                  <div className="text-muted-foreground">{receipt.submitter.email}</div>
                </dd>
              </div>
              {receipt.approver && (
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-sm font-medium text-muted-foreground">{t("approver")}</dt>
                  <dd className="col-span-2 text-sm">
                    <div>{receipt.approver.name}</div>
                    {receipt.approvedAt && (
                      <div className="text-muted-foreground">{format(new Date(receipt.approvedAt), "dd MMM yyyy HH:mm")}</div>
                    )}
                  </dd>
                </div>
              )}
              {receipt.status === "REJECTED" && receipt.rejectionReason && (
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-sm font-medium text-muted-foreground">{t("rejectionReason")}</dt>
                  <dd className="col-span-2 text-sm text-red-600">{receipt.rejectionReason}</dd>
                </div>
              )}
              {receipt.status === "APPROVED" && receipt.journalEntry && (
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-sm font-medium text-muted-foreground">{t("journalEntry")}</dt>
                  <dd className="col-span-2">
                    <Button
                      variant="link"
                      className="h-auto p-0 text-blue-600"
                      onClick={() => router.push(`/finance/journal-entries/${receipt.journalEntry!.id}`)}
                    >
                      <FileText className="mr-1 h-4 w-4" />
                      {receipt.journalEntry.entryNumber}
                    </Button>
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectReceipt")}</DialogTitle>
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
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={actionLoading}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
              {actionLoading ? tc("loading") : t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
