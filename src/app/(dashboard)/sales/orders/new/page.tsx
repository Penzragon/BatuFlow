"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface Customer {
  id: string;
  name: string;
  paymentTermsDays: number;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  sellPrice: number;
  baseUom: string;
}

interface StaffUser {
  id: string;
  name: string;
}

type DiscountType = "percent" | "amount";

interface SOLine {
  productId: string;
  productName: string;
  productSku: string;
  qty: number;
  unitPrice: number;
  discountType: DiscountType;
  discountPercent: number;
  discountAmount: number;
  priceOverride: boolean;
  uom: string;
  lineTotal: number;
}

export default function CreateSalesOrderPage() {
  const t = useTranslations("salesOrders");
  const tc = useTranslations("common");
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [salespersonId, setSalespersonId] = useState("");
  const [salespeople, setSalespeople] = useState<StaffUser[]>([]);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [activeVisit, setActiveVisit] = useState<{ id: string; checkInAt: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<SOLine[]>([]);
  const [includePpn, setIncludePpn] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchApplicablePrice = useCallback(async (productId: string, qty: number) => {
    const res = await fetch(`/api/products/${productId}/applicable-price?qty=${encodeURIComponent(qty)}`);
    const json = await res.json();
    return json.success ? (json.data as { unitPrice: number; tierApplied: string | null }) : null;
  }, []);

  const fetchCustomers = useCallback(async () => {
    const res = await fetch("/api/customers?pageSize=200");
    const json = await res.json();
    if (json.success) setCustomers(json.data.items);
  }, []);

  const fetchProducts = useCallback(async () => {
    const res = await fetch("/api/products?pageSize=500");
    const json = await res.json();
    if (json.success) setProducts(json.data.items);
  }, []);

  const fetchSalespeople = useCallback(async () => {
    try {
      const res = await fetch("/api/users?role=STAFF&pageSize=200");
      const json = await res.json();
      if (json.success) setSalespeople(json.data.items ?? []);
    } catch {
      setSalespeople([]);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
    fetchSalespeople();
  }, [fetchCustomers, fetchProducts, fetchSalespeople]);

  useEffect(() => {
    if (!customerId) {
      setActiveVisit(null);
      setVisitId(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/visits/active?customerId=${customerId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setActiveVisit(json.data);
          setVisitId(json.data.id);
        } else {
          setActiveVisit(null);
          setVisitId(null);
        }
      } catch {
        setActiveVisit(null);
        setVisitId(null);
      }
    })();
  }, [customerId]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        productId: "",
        productName: "",
        productSku: "",
        qty: 1,
        unitPrice: 0,
        discountType: "percent" as DiscountType,
        discountPercent: 0,
        discountAmount: 0,
        priceOverride: false,
        uom: "pcs",
        lineTotal: 0,
      },
    ]);
  };

  const updateLine = (index: number, field: keyof SOLine, value: unknown) => {
    setLines((prev) => {
      const updated = [...prev];
      const line = { ...updated[index], [field]: value };

      if (field === "productId") {
        const product = products.find((p) => p.id === value);
        if (product) {
          line.productName = product.name;
          line.productSku = product.sku;
          line.unitPrice = product.sellPrice;
          line.uom = product.baseUom;
        }
      }

      const lineSubtotal = line.unitPrice * line.qty;
      if (line.discountType === "amount") {
        const discount = Math.min(line.discountAmount, lineSubtotal);
        line.lineTotal = lineSubtotal - discount;
      } else {
        const discount = (lineSubtotal * line.discountPercent) / 100;
        line.lineTotal = lineSubtotal - discount;
      }

      updated[index] = line;
      return updated;
    });

    if (field === "productId" || field === "qty") {
      const productId = field === "productId" ? (value as string) : lines[index]?.productId;
      const qty = field === "qty" ? (typeof value === "number" ? value : Number(value) || 1) : (lines[index]?.qty ?? 1);
      if (productId && !lines[index]?.priceOverride) {
        fetchApplicablePrice(productId, qty).then((data) => {
          if (data)
            setLines((prev) => {
              const next = [...prev];
              const l = next[index];
              if (l && l.productId === productId && !l.priceOverride) {
                const lineSubtotal = data.unitPrice * l.qty;
                const lineTotal = l.discountType === "amount"
                  ? lineSubtotal - Math.min(l.discountAmount, lineSubtotal)
                  : lineSubtotal - (lineSubtotal * l.discountPercent) / 100;
                next[index] = { ...l, unitPrice: data.unitPrice, lineTotal };
              }
              return next;
            });
        });
      }
    }
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const totalBeforeDiscount = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const totalDiscount = totalBeforeDiscount - subtotal;
  const ppnAmount = includePpn ? subtotal * 0.11 : 0;
  const grandTotal = subtotal + ppnAmount;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const handleSubmit = async () => {
    if (!customerId) {
      toast.error("Please select a customer");
      return;
    }
    if (lines.length === 0 || lines.some((l) => !l.productId)) {
      toast.error("Please add at least one product line");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerId,
        visitId: visitId ?? undefined,
        salespersonId: salespersonId || undefined,
        notes: notes || undefined,
        includePpn,
        lines: lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unitPrice: l.priceOverride ? l.unitPrice : undefined,
          ...(l.discountType === "amount"
            ? { discountAmount: l.discountAmount }
            : { discountPercent: l.discountPercent }),
          priceOverride: l.priceOverride,
          uom: l.uom,
        })),
      };

      const res = await fetch("/api/sales-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(t("created"));
        router.push(`/sales/orders/${json.data.id}`);
      } else {
        toast.error(json.error || "Failed to create order");
      }
    } catch {
      toast.error("Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("createOrder")}
        actions={
          <Button variant="outline" onClick={() => router.push("/sales/orders")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tc("back")}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("customer")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t("customer")}</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {customerId && (
                <div className="text-sm">
                  {activeVisit ? (
                    <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                      {t("activeVisit")}: {new Date(activeVisit.checkInAt).toLocaleString()}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-50">
                      {t("noActiveVisit")}
                    </Badge>
                  )}
                </div>
              )}

              {salespeople.length > 0 && (
                <div>
                  <Label>{t("salesperson")}</Label>
                  <Select value={salespersonId} onValueChange={setSalespersonId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectSalesperson")} />
                    </SelectTrigger>
                    <SelectContent>
                      {salespeople.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>{t("notes")}</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("lines")}</CardTitle>
              <Button size="sm" onClick={addLine}>
                <Plus className="mr-1 h-4 w-4" />
                {t("addLine")}
              </Button>
            </CardHeader>
            <CardContent>
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t("noLines")}</p>
              ) : (
                <div className="space-y-4">
                  {lines.map((line, idx) => (
                    <div key={idx} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">#{idx + 1}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeLine(idx)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="col-span-2">
                          <Label>{t("product")}</Label>
                          <Select
                            value={line.productId}
                            onValueChange={(val) => updateLine(idx, "productId", val)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t("selectProduct")} />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.sku} - {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>{t("qty")}</Label>
                          <Input
                            type="number"
                            min={0.01}
                            step={1}
                            value={line.qty}
                            onChange={(e) => updateLine(idx, "qty", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label>{t("unitPrice")}</Label>
                          <Input
                            type="number"
                            min={0}
                            value={line.unitPrice}
                            onChange={(e) => updateLine(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                            disabled={!line.priceOverride}
                          />
                        </div>
                        <div>
                          <Label>Discount</Label>
                          <div className="flex gap-2">
                            <Select
                              value={line.discountType}
                              onValueChange={(val: DiscountType) => {
                                const sub = line.unitPrice * line.qty;
                                setLines((prev) => {
                                  const next = [...prev];
                                  const l = { ...next[idx] };
                                  if (val === "amount") {
                                    l.discountType = "amount";
                                    l.discountAmount = (sub * l.discountPercent) / 100;
                                    l.lineTotal = sub - l.discountAmount;
                                  } else {
                                    l.discountType = "percent";
                                    l.discountPercent = sub > 0 ? (l.discountAmount / sub) * 100 : 0;
                                    l.lineTotal = sub - (sub * l.discountPercent) / 100;
                                  }
                                  next[idx] = l;
                                  return next;
                                });
                              }}
                            >
                              <SelectTrigger className="w-[100px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percent">%</SelectItem>
                                <SelectItem value="amount">Rp</SelectItem>
                              </SelectContent>
                            </Select>
                            {line.discountType === "percent" ? (
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={line.discountPercent || ""}
                                onChange={(e) => updateLine(idx, "discountPercent", parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="flex-1"
                              />
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                step={1000}
                                value={line.discountAmount || ""}
                                onChange={(e) => updateLine(idx, "discountAmount", parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="flex-1"
                              />
                            )}
                          </div>
                        </div>
                        <div className="flex items-end gap-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`override-${idx}`}
                              checked={line.priceOverride}
                              onCheckedChange={(checked) => updateLine(idx, "priceOverride", !!checked)}
                            />
                            <Label htmlFor={`override-${idx}`} className="text-xs">{t("priceOverride")}</Label>
                          </div>
                        </div>
                        <div className="flex items-end">
                          <div className="text-sm font-medium">{formatCurrency(line.lineTotal)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-ppn"
                  checked={includePpn}
                  onCheckedChange={(c) => setIncludePpn(!!c)}
                />
                <Label htmlFor="include-ppn" className="text-sm font-normal cursor-pointer">
                  {t("ppn")}
                </Label>
              </div>
              <div className="flex justify-between text-sm">
                <span>Items total</span>
                <span>{formatCurrency(totalBeforeDiscount)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>{t("discount")}</span>
                  <span>-{formatCurrency(totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>{t("subtotal")}</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t("ppn")}</span>
                <span>{formatCurrency(ppnAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-3">
                <span>{t("grandTotal")}</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>

              <Button
                className="w-full mt-4"
                onClick={handleSubmit}
                disabled={submitting || !customerId || lines.length === 0}
              >
                {submitting ? tc("loading") : t("createOrder")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
