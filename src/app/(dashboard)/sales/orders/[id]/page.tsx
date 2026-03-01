"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, Truck, CheckCircle, XCircle, Clock, AlertTriangle, Printer } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface SOLine {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  uom: string;
  qty: number;
  unitPrice: number;
  tierApplied: string | null;
  discountPercent: number;
  discountAmount: number;
  priceOverride: boolean;
  lineTotal: number;
}

interface SODetail {
  id: string;
  soNumber: string;
  status: string;
  subtotal: number;
  discountTotal: number;
  ppnRate: number;
  ppnAmount: number;
  grandTotal: number;
  notes: string | null;
  needsApproval: boolean;
  approvalReason: string | null;
  rejectionReason: string | null;
  createdAt: string;
  customer: { id: string; name: string; paymentTermsDays: number };
  creator: { id: string; name: string };
  visit: { id: string; checkInAt: string } | null;
  lines: SOLine[];
  deliveryOrders: { id: string; doNumber: string; status: string; createdAt: string }[];
}

export default function SalesOrderDetailPage() {
  const t = useTranslations("salesOrders");
  const tc = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [so, setSO] = useState<SODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSO = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sales-orders/${id}`);
      const json = await res.json();
      if (json.success) setSO(json.data);
      else toast.error(json.error);
    } catch {
      toast.error("Failed to load sales order");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSO();
  }, [fetchSO]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const performAction = async (url: string, body?: object) => {
    setActionLoading(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (json.success) {
        fetchSO();
        return true;
      } else {
        toast.error(json.error);
        return false;
      }
    } catch {
      toast.error("Action failed");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirm = async () => {
    const ok = await performAction(`/api/sales-orders/${id}/confirm`);
    if (ok) {
      toast.success(t("confirmedSuccess"));
      setConfirmOpen(false);
    }
  };

  const handleApprove = async () => {
    const ok = await performAction(`/api/sales-orders/${id}/approve`);
    if (ok) toast.success(t("approvedSuccess"));
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    const ok = await performAction(`/api/sales-orders/${id}/reject`, { reason: rejectionReason });
    if (ok) {
      toast.success(t("rejectedSuccess"));
      setRejectOpen(false);
      setRejectionReason("");
    }
  };

  const handleCancel = async () => {
    const ok = await performAction(`/api/sales-orders/${id}/cancel`);
    if (ok) {
      toast.success(t("cancelledSuccess"));
      setCancelOpen(false);
    }
  };

  const handleCreateDO = () => {
    router.push(`/sales/delivery-orders?createFrom=${id}`);
  };

  if (loading || !so) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("soNumber")}: ${so.soNumber}`}
        actions={
          <div className="flex items-center gap-2">
            {so.status === "DRAFT" && (
              <>
                <Button onClick={() => setConfirmOpen(true)}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {t("confirm")}
                </Button>
                <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                  <XCircle className="mr-2 h-4 w-4" />
                  {t("cancel")}
                </Button>
              </>
            )}
            {so.status === "WAITING_APPROVAL" && (
              <>
                <Button onClick={handleApprove} disabled={actionLoading}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {t("approve")}
                </Button>
                <Button variant="destructive" onClick={() => setRejectOpen(true)}>
                  <XCircle className="mr-2 h-4 w-4" />
                  {t("reject")}
                </Button>
              </>
            )}
            {["CONFIRMED", "PARTIALLY_DELIVERED"].includes(so.status) && (
              <Button onClick={handleCreateDO}>
                <Truck className="mr-2 h-4 w-4" />
                {t("createDO")}
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href={`/sales/orders/${id}/print`} target="_blank" rel="noopener noreferrer">
                <Printer className="mr-2 h-4 w-4" />
                {t("print")}
              </Link>
            </Button>
            <Button variant="outline" onClick={() => router.push("/sales/orders")}>
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
                    <TableHead className="text-right">{t("qty")}</TableHead>
                    <TableHead className="text-right">{t("unitPrice")}</TableHead>
                    <TableHead className="text-right">{t("discountPercent")}</TableHead>
                    <TableHead className="text-right">{t("lineTotal")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {so.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{line.productName}</span>
                          <span className="text-xs text-muted-foreground ml-2">({line.productSku})</span>
                        </div>
                        {line.tierApplied && (
                          <span className="text-xs text-blue-600">Tier: {line.tierApplied}</span>
                        )}
                        {line.priceOverride && (
                          <span className="text-xs text-orange-600 ml-2">Override</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{line.qty} {line.uom}</TableCell>
                      <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                      <TableCell className="text-right">{Number(line.discountPercent).toFixed(2)}%</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(line.lineTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {so.deliveryOrders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Delivery Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DO Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {so.deliveryOrders.map((dOrder) => (
                      <TableRow
                        key={dOrder.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => router.push(`/sales/delivery-orders/${dOrder.id}`)}
                      >
                        <TableCell className="font-medium text-blue-600">{dOrder.doNumber}</TableCell>
                        <TableCell><StatusBadge status={dOrder.status} /></TableCell>
                        <TableCell>{format(new Date(dOrder.createdAt), "dd MMM yyyy")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={so.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("customer")}</span>
                <span className="font-medium">{so.customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created By</span>
                <span>{so.creator.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{format(new Date(so.createdAt), "dd MMM yyyy HH:mm")}</span>
              </div>
              {so.visit && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Visit</span>
                  <span className="text-xs">{format(new Date(so.visit.checkInAt), "dd MMM HH:mm")}</span>
                </div>
              )}
              {so.notes && (
                <div>
                  <span className="text-muted-foreground">{t("notes")}</span>
                  <p className="mt-1">{so.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>{t("subtotal")}</span>
                <span>{formatCurrency(so.subtotal)}</span>
              </div>
              {so.discountTotal > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>{t("discount")}</span>
                  <span>-{formatCurrency(so.discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>{t("ppn")}</span>
                <span>{formatCurrency(so.ppnAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>{t("grandTotal")}</span>
                <span>{formatCurrency(so.grandTotal)}</span>
              </div>
            </CardContent>
          </Card>

          {so.needsApproval && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-800">{t("needsApproval")}</p>
                    <p className="text-sm text-orange-700 mt-1">{so.approvalReason}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {so.rejectionReason && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">{t("rejectionReason")}</p>
                    <p className="text-sm text-red-700 mt-1">{so.rejectionReason}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
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

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancel")}</AlertDialogTitle>
            <AlertDialogDescription>{t("cancelMessage")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={actionLoading} className="bg-red-600 hover:bg-red-700">
              {t("cancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reject")}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>{t("rejectionReason")}</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="Provide a reason for rejection..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>{tc("cancel")}</Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
              {t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
