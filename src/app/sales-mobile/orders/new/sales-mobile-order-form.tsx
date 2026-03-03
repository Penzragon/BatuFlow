"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

type Customer = { id: string; name: string };
type Product = { id: string; sku: string; name: string; sellPrice: number; baseUom: string };

type DiscountType = "percent" | "amount";
type Line = {
  productId: string;
  qty: number;
  unitPrice: number;
  discountType: DiscountType;
  discountPercent: number;
  discountAmount: number;
  priceOverride: boolean;
  uom: string;
};

type OrderDraft = {
  version: 1;
  customerId: string;
  notes: string;
  includePpn: boolean;
  lines: Line[];
};

const ORDER_DRAFT_KEY = "batuflow:sales-mobile:order-draft:v1";

export default function SalesMobileOrderForm() {
  const router = useRouter();
  const t = useTranslations("salesMobile.orders.form");
  const locale = useLocale();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [visitId, setVisitId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [includePpn, setIncludePpn] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const fetchApplicablePrice = useCallback(async (productId: string, qty: number) => {
    const res = await fetch(`/api/products/${productId}/applicable-price?qty=${encodeURIComponent(qty)}`);
    const json = await res.json();
    return json.success ? (json.data as { unitPrice: number }) : null;
  }, []);

  useEffect(() => {
    fetchCustomers();
    fetchProducts();

    return () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    };
  }, [fetchCustomers, fetchProducts]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_DRAFT_KEY);
      if (!raw) {
        setDraftReady(true);
        return;
      }
      const parsed = JSON.parse(raw) as OrderDraft;
      if (parsed.version !== 1) {
        setDraftReady(true);
        return;
      }

      setCustomerId(parsed.customerId || "");
      setNotes(parsed.notes || "");
      setIncludePpn(parsed.includePpn ?? true);
      setLines(Array.isArray(parsed.lines) ? parsed.lines : []);
      setDraftRestored(Boolean(parsed.customerId || parsed.notes || parsed.lines?.length));
    } catch {
      // ignore bad draft payload
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);

    draftSaveTimerRef.current = setTimeout(() => {
      const draft: OrderDraft = {
        version: 1,
        customerId,
        notes,
        includePpn,
        lines,
      };
      try {
        localStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // ignore localStorage errors
      }
    }, 350);
  }, [customerId, notes, includePpn, lines, draftReady]);

  useEffect(() => {
    if (!customerId) {
      setVisitId(null);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/visits/active?customerId=${customerId}`);
        const json = await res.json();
        setVisitId(json.success && json.data ? json.data.id : null);
      } catch {
        setVisitId(null);
      }
    })();
  }, [customerId]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(ORDER_DRAFT_KEY);
    } catch {
      // no-op
    }
    setCustomerId("");
    setNotes("");
    setIncludePpn(true);
    setLines([]);
    setDraftRestored(false);
    toast.success(t("draft.cleared"));
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        productId: "",
        qty: 1,
        unitPrice: 0,
        discountType: "percent",
        discountPercent: 0,
        discountAmount: 0,
        priceOverride: false,
        uom: "pcs",
      },
    ]);
  };

  const updateLine = (index: number, patch: Partial<Line>) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const lineTotal = (line: Line) => {
    const subtotal = line.unitPrice * line.qty;
    if (line.discountType === "amount") return subtotal - Math.min(line.discountAmount, subtotal);
    return subtotal - (subtotal * line.discountPercent) / 100;
  };

  const totals = useMemo(() => {
    const totalBeforeDiscount = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
    const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
    const totalDiscount = totalBeforeDiscount - subtotal;
    const ppnAmount = includePpn ? subtotal * 0.11 : 0;
    const grandTotal = subtotal + ppnAmount;
    return { totalBeforeDiscount, subtotal, totalDiscount, ppnAmount, grandTotal };
  }, [lines, includePpn]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "IDR", minimumFractionDigits: locale === "id" ? 0 : 2 }).format(val);

  const onSubmit = async () => {
    if (!customerId) return toast.error(t("errors.customerRequired"));
    if (lines.length === 0 || lines.some((l) => !l.productId || l.qty <= 0)) return toast.error(t("errors.invalidOrderLines"));

    setSubmitting(true);
    try {
      const payload = {
        customerId,
        visitId: visitId ?? undefined,
        notes: notes || undefined,
        includePpn,
        lines: lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unitPrice: l.priceOverride ? l.unitPrice : undefined,
          ...(l.discountType === "amount" ? { discountAmount: l.discountAmount } : { discountPercent: l.discountPercent }),
          priceOverride: l.priceOverride,
          uom: l.uom,
        })),
      };

      const res = await fetch("/api/sales-mobile/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!json.success) {
        toast.error(json.error ?? t("errors.createOrderFailed"));
        return;
      }

      try {
        localStorage.removeItem(ORDER_DRAFT_KEY);
      } catch {
        // no-op
      }
      toast.success(t("success"));
      router.push(`/sales-mobile/orders/${json.data.id}`);
    } catch {
      toast.error(t("errors.createOrderFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>

      {draftRestored && (
        <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span>{t("draft.restored")}</span>
          <Button variant="outline" size="sm" onClick={clearDraft}>
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            {t("draft.clear")}
          </Button>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{t("customerSection.title")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>{t("customerSection.customerLabel")}</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder={t("customerSection.customerPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("customerSection.notesLabel")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="ppn" checked={includePpn} onCheckedChange={(v) => setIncludePpn(!!v)} />
            <Label htmlFor="ppn">{t("customerSection.includePpn")}</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("linesSection.title")}</CardTitle>
          <Button size="sm" onClick={addLine}><Plus className="mr-1 h-4 w-4" />{t("linesSection.add")}</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.length === 0 ? <p className="text-sm text-muted-foreground">{t("linesSection.empty")}</p> : lines.map((line, idx) => (
            <div key={idx} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("linesSection.lineNumber", { index: idx + 1 })}</span>
                <Button size="icon" variant="ghost" onClick={() => removeLine(idx)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label>{t("linesSection.productLabel")}</Label>
                  <Select
                    value={line.productId}
                    onValueChange={(productId) => {
                      const product = products.find((p) => p.id === productId);
                      if (!product) return;
                      updateLine(idx, { productId, unitPrice: product.sellPrice, uom: product.baseUom });
                      if (!line.priceOverride) {
                        fetchApplicablePrice(productId, line.qty).then((d) => {
                          if (d) updateLine(idx, { unitPrice: d.unitPrice });
                        });
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder={t("linesSection.productPlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} - {p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t("linesSection.qtyLabel")}</Label>
                  <Input
                    type="number"
                    min={0.01}
                    value={line.qty}
                    onChange={(e) => {
                      const qty = parseFloat(e.target.value) || 0;
                      updateLine(idx, { qty });
                      if (line.productId && !line.priceOverride) {
                        fetchApplicablePrice(line.productId, qty).then((d) => d && updateLine(idx, { unitPrice: d.unitPrice }));
                      }
                    }}
                  />
                </div>
                <div>
                  <Label>{t("linesSection.unitPriceLabel")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={line.unitPrice}
                    disabled={!line.priceOverride}
                    onChange={(e) => updateLine(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>{t("linesSection.discountTypeLabel")}</Label>
                  <Select value={line.discountType} onValueChange={(v: DiscountType) => updateLine(idx, { discountType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">{t("linesSection.discountTypes.percent")}</SelectItem>
                      <SelectItem value="amount">{t("linesSection.discountTypes.amount")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("linesSection.discountValueLabel")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={line.discountType === "percent" ? line.discountPercent : line.discountAmount}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value) || 0;
                      if (line.discountType === "percent") updateLine(idx, { discountPercent: num });
                      else updateLine(idx, { discountAmount: num });
                    }}
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Checkbox id={`override-${idx}`} checked={line.priceOverride} onCheckedChange={(v) => updateLine(idx, { priceOverride: !!v })} />
                  <Label htmlFor={`override-${idx}`}>{t("linesSection.priceOverride")}</Label>
                </div>
              </div>

              <div className="text-sm font-medium">{t("linesSection.lineTotal")}: {formatCurrency(lineTotal(line))}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("summary.title")}</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between"><span>{t("summary.itemsTotal")}</span><span>{formatCurrency(totals.totalBeforeDiscount)}</span></div>
          <div className="flex justify-between"><span>{t("summary.discount")}</span><span>-{formatCurrency(totals.totalDiscount)}</span></div>
          <div className="flex justify-between"><span>{t("summary.subtotal")}</span><span>{formatCurrency(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span>{t("summary.ppn")}</span><span>{formatCurrency(totals.ppnAmount)}</span></div>
          <div className="flex justify-between border-t pt-2 font-semibold"><span>{t("summary.grandTotal")}</span><span>{formatCurrency(totals.grandTotal)}</span></div>
          <Button className="mt-3 w-full" disabled={submitting} onClick={onSubmit}>{submitting ? t("submitting") : t("submit")}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
