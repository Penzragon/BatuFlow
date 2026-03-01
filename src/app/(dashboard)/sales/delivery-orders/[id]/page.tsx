"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, CheckCircle, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface DOLine {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  uom: string;
  qtyOrdered: number;
  qtyDelivered: number;
}

interface DODetail {
  id: string;
  doNumber: string;
  status: string;
  notes: string | null;
  confirmedAt: string | null;
  createdAt: string;
  salesOrder: { id: string; soNumber: string; customer: { id: string; name: string } };
  creator: { id: string; name: string };
  lines: DOLine[];
  invoices: { id: string; invoiceNumber: string; status: string; createdAt: string }[];
}

export default function DeliveryOrderDetailPage() {
  const t = useTranslations("deliveryOrders");
  const tc = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [deliveryOrder, setDO] = useState<DODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const fetchDO = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/delivery-orders/${id}`);
      const json = await res.json();
      if (json.success) setDO(json.data);
      else toast.error(json.error);
    } catch {
      toast.error("Failed to load delivery order");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDO();
  }, [fetchDO]);

  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/delivery-orders/${id}/confirm`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success(t("confirmedSuccess"));
        setConfirmOpen(false);
        fetchDO();
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error("Failed to confirm delivery order");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    setCreatingInvoice(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doId: id }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Invoice created");
        router.push(`/sales/invoices/${json.data.id}`);
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error("Failed to create invoice");
    } finally {
      setCreatingInvoice(false);
    }
  };

  if (loading || !deliveryOrder) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("doNumber")}: ${deliveryOrder.doNumber}`}
        actions={
          <div className="flex items-center gap-2">
            {deliveryOrder.status === "DRAFT" && (
              <Button onClick={() => setConfirmOpen(true)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                {t("confirm")}
              </Button>
            )}
            {deliveryOrder.status === "CONFIRMED" && deliveryOrder.invoices.length === 0 && (
              <Button onClick={handleCreateInvoice} disabled={creatingInvoice}>
                <FileText className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href={`/sales/delivery-orders/${id}/print`} target="_blank" rel="noopener noreferrer">
                <Printer className="mr-2 h-4 w-4" />
                {t("print")}
              </Link>
            </Button>
            <Button variant="outline" onClick={() => router.push("/sales/delivery-orders")}>
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
              <CardTitle>{t("lines")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("product")}</TableHead>
                    <TableHead className="text-right">{t("qtyOrdered")}</TableHead>
                    <TableHead className="text-right">{t("qtyDelivered")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryOrder.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <span className="font-medium">{line.productName}</span>
                        <span className="text-xs text-muted-foreground ml-2">({line.productSku})</span>
                      </TableCell>
                      <TableCell className="text-right">{line.qtyOrdered} {line.uom}</TableCell>
                      <TableCell className="text-right font-medium">{line.qtyDelivered} {line.uom}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {deliveryOrder.invoices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveryOrder.invoices.map((inv) => (
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => router.push(`/sales/invoices/${inv.id}`)}
                      >
                        <TableCell className="font-medium text-blue-600">{inv.invoiceNumber}</TableCell>
                        <TableCell><StatusBadge status={inv.status} /></TableCell>
                        <TableCell>{format(new Date(inv.createdAt), "dd MMM yyyy")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={deliveryOrder.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("salesOrder")}</span>
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => router.push(`/sales/orders/${deliveryOrder.salesOrder.id}`)}
                >
                  {deliveryOrder.salesOrder.soNumber}
                </button>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{deliveryOrder.salesOrder.customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created By</span>
                <span>{deliveryOrder.creator.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{format(new Date(deliveryOrder.createdAt), "dd MMM yyyy HH:mm")}</span>
              </div>
              {deliveryOrder.confirmedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confirmed At</span>
                  <span>{format(new Date(deliveryOrder.confirmedAt), "dd MMM yyyy HH:mm")}</span>
                </div>
              )}
              {deliveryOrder.notes && (
                <div>
                  <span className="text-muted-foreground">{t("notes")}</span>
                  <p className="mt-1">{deliveryOrder.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmMessage")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={actionLoading}>
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
