"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, Send, CreditCard, Printer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Payment {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  paymentDate: string;
  notes: string | null;
  createdAt: string;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  ppnAmount: number;
  grandTotal: number;
  amountPaid: number;
  dueDate: string;
  issuedAt: string | null;
  notes: string | null;
  createdAt: string;
  customer: { id: string; name: string; email: string | null; phone: string | null };
  deliveryOrder: {
    id: string;
    doNumber: string;
    lines: { productName: string; productSku: string; qtyDelivered: number; uom: string }[];
    salesOrder: { id: string; soNumber: string };
  };
  payments: Payment[];
}

export default function InvoiceDetailPage() {
  const t = useTranslations("invoices");
  const tp = useTranslations("payments");
  const tc = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [issueOpen, setIssueOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("TRANSFER");
  const [payReference, setPayReference] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payNotes, setPayNotes] = useState("");

  const fetchInvoice = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/invoices/${id}`);
      const json = await res.json();
      if (json.success) setInvoice(json.data);
      else toast.error(json.error);
    } catch {
      toast.error("Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const handleIssue = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}/issue`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success(t("issuedSuccess"));
        setIssueOpen(false);
        fetchInvoice();
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error("Failed to issue invoice");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: id,
          amount,
          method: payMethod,
          reference: payReference || undefined,
          paymentDate: payDate,
          notes: payNotes || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(tp("recorded"));
        setPaymentOpen(false);
        setPayAmount("");
        setPayReference("");
        setPayNotes("");
        fetchInvoice();
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !invoice) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const balance = invoice.grandTotal - invoice.amountPaid;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("invoiceNumber")}: ${invoice.invoiceNumber}`}
        actions={
          <div className="flex items-center gap-2">
            {invoice.status === "DRAFT" && (
              <Button onClick={() => setIssueOpen(true)}>
                <Send className="mr-2 h-4 w-4" />
                {t("issue")}
              </Button>
            )}
            {["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) && (
              <Button onClick={() => setPaymentOpen(true)}>
                <CreditCard className="mr-2 h-4 w-4" />
                {tp("recordPayment")}
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href={`/sales/invoices/${id}/print`} target="_blank" rel="noopener noreferrer">
                <Printer className="mr-2 h-4 w-4" />
                {t("print")}
              </Link>
            </Button>
            <Button variant="outline" onClick={() => router.push("/sales/invoices")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tc("back")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty Delivered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.deliveryOrder.lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <span className="font-medium">{line.productName}</span>
                        <span className="text-xs text-muted-foreground ml-2">({line.productSku})</span>
                      </TableCell>
                      <TableCell className="text-right">{line.qtyDelivered} {line.uom}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tp("paymentHistory")}</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{tp("noPayments")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tp("paymentDate")}</TableHead>
                      <TableHead>{tp("method")}</TableHead>
                      <TableHead>{tp("reference")}</TableHead>
                      <TableHead className="text-right">{tp("amount")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{format(new Date(p.paymentDate), "dd MMM yyyy")}</TableCell>
                        <TableCell className="capitalize">{p.method.toLowerCase()}</TableCell>
                        <TableCell>{p.reference || "-"}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={invoice.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("customer")}</span>
                <span className="font-medium">{invoice.customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SO</span>
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => router.push(`/sales/orders/${invoice.deliveryOrder.salesOrder.id}`)}
                >
                  {invoice.deliveryOrder.salesOrder.soNumber}
                </button>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">DO</span>
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => router.push(`/sales/delivery-orders/${invoice.deliveryOrder.id}`)}
                >
                  {invoice.deliveryOrder.doNumber}
                </button>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("dueDate")}</span>
                <span className={balance > 0 && new Date(invoice.dueDate) < new Date() ? "text-red-600 font-medium" : ""}>
                  {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                </span>
              </div>
              {invoice.issuedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("issuedAt")}</span>
                  <span>{format(new Date(invoice.issuedAt), "dd MMM yyyy")}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(invoice.createdAt), "dd MMM yyyy")}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>{t("subtotal")}</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("ppn")}</span>
                <span>{formatCurrency(invoice.ppnAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>{t("grandTotal")}</span>
                <span>{formatCurrency(invoice.grandTotal)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>{t("amountPaid")}</span>
                <span>{formatCurrency(invoice.amountPaid)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>{t("balance")}</span>
                <span className={balance > 0 ? "text-red-600" : "text-green-600"}>
                  {formatCurrency(balance)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={issueOpen} onOpenChange={setIssueOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("issue")}</AlertDialogTitle>
            <AlertDialogDescription>{t("issueMessage")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleIssue} disabled={actionLoading}>
              {t("issue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tp("recordPayment")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{tp("amount")}</Label>
              <Input
                type="number"
                min={0.01}
                max={balance}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder={`Max: ${formatCurrency(balance)}`}
              />
            </div>
            <div>
              <Label>{tp("method")}</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">{tp("cash")}</SelectItem>
                  <SelectItem value="TRANSFER">{tp("transfer")}</SelectItem>
                  <SelectItem value="GIRO">{tp("giro")}</SelectItem>
                  <SelectItem value="CHECK">{tp("check")}</SelectItem>
                  <SelectItem value="OTHER">{tp("other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tp("reference")}</Label>
              <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} />
            </div>
            <div>
              <Label>{tp("paymentDate")}</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div>
              <Label>{tp("notes")}</Label>
              <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleRecordPayment} disabled={actionLoading}>
              {actionLoading ? tc("loading") : tp("recordPayment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
