"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Trash2, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { HistoryDrawer } from "@/components/shared/history-drawer";

interface PriceTier {
  id?: string;
  minQty: number;
  maxQty: number | null;
  unitPrice: number;
}

interface UomConversion {
  id?: string;
  fromUom: string;
  toUom: string;
  conversionRate: number;
}

interface CapitalHistoryEntry {
  id: string;
  oldCost: number;
  newCost: number;
  changedAt: string;
  changedBy: string;
  changedByName?: string;
  source: string;
  notes: string | null;
}

interface SellPriceHistoryEntry {
  id: string;
  oldPrice: number;
  newPrice: number;
  changedAt: string;
  changedBy: string;
  changedByName?: string;
  source: string;
  notes: string | null;
}

/** Single row for the combined price/cost history tab. */
type PriceHistoryRow =
  | { type: "capital_cost"; entry: CapitalHistoryEntry }
  | { type: "sell_price"; entry: SellPriceHistoryEntry };

interface ProductData {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  baseUom: string;
  capitalCost: number;
  sellPrice: number;
  minStock: number;
  maxStock: number;
  isActive: boolean;
  priceTiers: PriceTier[];
  uomConversions: UomConversion[];
  capitalHistory: CapitalHistoryEntry[];
  sellPriceHistory: SellPriceHistoryEntry[];
}

/** Formats a number as Indonesian Rupiah without decimals. */
function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Product detail / edit page with tabbed sections for:
 * - Details: main product fields form
 * - Price Tiers: editable tier table with add/remove
 * - UOM Conversions: editable unit conversions
 * - Cost History: read-only capital cost change timeline
 * - History: full audit trail via HistoryDrawer
 */
export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("products");
  const tCommon = useTranslations("common");

  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [form, setForm] = useState({
    sku: "",
    name: "",
    description: "",
    category: "",
    brand: "",
    baseUom: "pcs",
    capitalCost: 0,
    sellPrice: 0,
    minStock: 0,
    maxStock: 0,
    isActive: true,
  });

  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [savingTiers, setSavingTiers] = useState(false);

  const [conversions, setConversions] = useState<UomConversion[]>([]);
  const [savingConversions, setSavingConversions] = useState(false);

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${params.id}`);
      const json = await res.json();
      if (json.success) {
        const p: ProductData = json.data;
        setProduct(p);
        setForm({
          sku: p.sku,
          name: p.name,
          description: p.description ?? "",
          category: p.category ?? "",
          brand: p.brand ?? "",
          baseUom: p.baseUom,
          capitalCost: p.capitalCost,
          sellPrice: p.sellPrice,
          minStock: p.minStock,
          maxStock: p.maxStock,
          isActive: p.isActive,
        });
        setTiers(p.priceTiers.map((pt) => ({ minQty: pt.minQty, maxQty: pt.maxQty, unitPrice: pt.unitPrice })));
        setConversions(p.uomConversions.map((c) => ({ fromUom: c.fromUom, toUom: c.toUom, conversionRate: c.conversionRate })));
      } else {
        toast.error("Product not found");
        router.push("/inventory/products");
      }
    } catch {
      toast.error("Failed to load product");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          description: form.description || undefined,
          category: form.category || undefined,
          brand: form.brand || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Product updated");
        fetchProduct();
      } else {
        toast.error(json.error ?? "Failed to save");
      }
    } catch {
      toast.error("Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTiers = async () => {
    setSavingTiers(true);
    try {
      const res = await fetch(`/api/products/${params.id}/price-tiers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiers }),
      });
      const json = await res.json();
      if (json.success) toast.success("Price tiers saved");
      else toast.error(json.error ?? "Failed to save tiers");
    } catch {
      toast.error("Failed to save price tiers");
    } finally {
      setSavingTiers(false);
    }
  };

  const handleSaveConversions = async () => {
    setSavingConversions(true);
    try {
      const res = await fetch(`/api/products/${params.id}/uom-conversions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversions }),
      });
      const json = await res.json();
      if (json.success) toast.success("UOM conversions saved");
      else toast.error(json.error ?? "Failed to save conversions");
    } catch {
      toast.error("Failed to save UOM conversions");
    } finally {
      setSavingConversions(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("editProduct")}
        description={`${product.sku} – ${product.name}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setHistoryOpen(true)}>
              <Clock className="mr-2 h-4 w-4" />
              History
            </Button>
            <Button variant="outline" onClick={() => router.push("/inventory/products")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tCommon("back")}
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="priceTiers">{t("priceTiers")}</TabsTrigger>
          <TabsTrigger value="uomConversions">{t("uom")}</TabsTrigger>
          <TabsTrigger value="costHistory">{t("costHistory")}</TabsTrigger>
        </TabsList>

        {/* ── Details Tab ── */}
        <TabsContent value="details">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sku">{t("sku")}</Label>
                  <Input id="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">{t("name")}</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">{t("description")}</Label>
                  <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">{t("category")}</Label>
                  <Input id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">{t("brand")}</Label>
                  <Input id="brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baseUom">{t("uom")}</Label>
                  <Input id="baseUom" value={form.baseUom} onChange={(e) => setForm({ ...form, baseUom: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capitalCost">{t("capitalCost")}</Label>
                  <Input id="capitalCost" type="number" min={0} value={form.capitalCost} onChange={(e) => setForm({ ...form, capitalCost: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sellPrice">{t("sellPrice")}</Label>
                  <Input id="sellPrice" type="number" min={0} value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minStock">{t("minStock")}</Label>
                  <Input id="minStock" type="number" min={0} value={form.minStock} onChange={(e) => setForm({ ...form, minStock: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxStock">{t("maxStock")}</Label>
                  <Input id="maxStock" type="number" min={0} value={form.maxStock} onChange={(e) => setForm({ ...form, maxStock: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center gap-3">
                  <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                  <Label htmlFor="isActive">{t("active")}</Label>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? tCommon("loading") : tCommon("save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Price Tiers Tab ── */}
        <TabsContent value="priceTiers">
          <Card className="rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("priceTiers")}</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTiers([...tiers, { minQty: 1, maxQty: null, unitPrice: 0 }])}
              >
                <Plus className="mr-1 h-4 w-4" /> Add Tier
              </Button>
            </CardHeader>
            <CardContent>
              {tiers.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No price tiers defined.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Min Qty</TableHead>
                      <TableHead>Max Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tiers.map((tier, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={tier.minQty}
                            onChange={(e) => {
                              const next = [...tiers];
                              next[i] = { ...tier, minQty: parseInt(e.target.value) || 1 };
                              setTiers(next);
                            }}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={tier.maxQty ?? ""}
                            placeholder="∞"
                            onChange={(e) => {
                              const next = [...tiers];
                              const val = e.target.value ? parseInt(e.target.value) : null;
                              next[i] = { ...tier, maxQty: val };
                              setTiers(next);
                            }}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={tier.unitPrice}
                            onChange={(e) => {
                              const next = [...tiers];
                              next[i] = { ...tier, unitPrice: parseFloat(e.target.value) || 0 };
                              setTiers(next);
                            }}
                            className="w-36"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-4 flex justify-end">
                <Button onClick={handleSaveTiers} disabled={savingTiers}>
                  <Save className="mr-2 h-4 w-4" />
                  {savingTiers ? tCommon("loading") : tCommon("save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── UOM Conversions Tab ── */}
        <TabsContent value="uomConversions">
          <Card className="rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("uom")} Conversions</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConversions([...conversions, { fromUom: "pcs", toUom: "", conversionRate: 1 }])}
              >
                <Plus className="mr-1 h-4 w-4" /> Add Conversion
              </Button>
            </CardHeader>
            <CardContent>
              {conversions.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No UOM conversions defined.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From UOM</TableHead>
                      <TableHead>To UOM</TableHead>
                      <TableHead>Conversion Rate</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversions.map((conv, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Input
                            value={conv.fromUom}
                            onChange={(e) => {
                              const next = [...conversions];
                              next[i] = { ...conv, fromUom: e.target.value };
                              setConversions(next);
                            }}
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={conv.toUom}
                            onChange={(e) => {
                              const next = [...conversions];
                              next[i] = { ...conv, toUom: e.target.value };
                              setConversions(next);
                            }}
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={conv.conversionRate}
                            onChange={(e) => {
                              const next = [...conversions];
                              next[i] = { ...conv, conversionRate: parseFloat(e.target.value) || 0 };
                              setConversions(next);
                            }}
                            className="w-32"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setConversions(conversions.filter((_, j) => j !== i))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-4 flex justify-end">
                <Button onClick={handleSaveConversions} disabled={savingConversions}>
                  <Save className="mr-2 h-4 w-4" />
                  {savingConversions ? tCommon("loading") : tCommon("save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Cost History Tab (capital cost + sell price changes) ── */}
        <TabsContent value="costHistory">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>{t("costHistory")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Capital cost and sell price changes, newest first.
              </p>
            </CardHeader>
            <CardContent>
              {(() => {
                const capitalRows: PriceHistoryRow[] = (product.capitalHistory ?? []).map((entry) => ({
                  type: "capital_cost" as const,
                  entry,
                }));
                const sellRows: PriceHistoryRow[] = (product.sellPriceHistory ?? []).map((entry) => ({
                  type: "sell_price" as const,
                  entry,
                }));
                const combined: PriceHistoryRow[] = [...capitalRows, ...sellRows].sort(
                  (a, b) =>
                    new Date(b.type === "capital_cost" ? b.entry.changedAt : b.entry.changedAt).getTime() -
                    new Date(a.type === "capital_cost" ? a.entry.changedAt : a.entry.changedAt).getTime()
                );
                if (combined.length === 0) {
                  return (
                    <p className="py-8 text-center text-muted-foreground">
                      No price or cost changes recorded yet. Edit the product and save to see history here.
                    </p>
                  );
                }
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Old Value</TableHead>
                        <TableHead>New Value</TableHead>
                        <TableHead>Changed By</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {combined.map((row) =>
                        row.type === "capital_cost" ? (
                          <TableRow key={`cap-${row.entry.id}`}>
                            <TableCell className="whitespace-nowrap">
                              {new Date(row.entry.changedAt).toLocaleDateString("id-ID", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">Capital Cost</Badge>
                            </TableCell>
                            <TableCell>{formatRupiah(row.entry.oldCost)}</TableCell>
                            <TableCell>{formatRupiah(row.entry.newCost)}</TableCell>
                            <TableCell className="text-sm">
                              {row.entry.changedByName ?? row.entry.changedBy}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {row.entry.source}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.entry.notes ?? "–"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          <TableRow key={`sell-${row.entry.id}`}>
                            <TableCell className="whitespace-nowrap">
                              {new Date(row.entry.changedAt).toLocaleDateString("id-ID", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">Sell Price</Badge>
                            </TableCell>
                            <TableCell>{formatRupiah(row.entry.oldPrice)}</TableCell>
                            <TableCell>{formatRupiah(row.entry.newPrice)}</TableCell>
                            <TableCell className="text-sm">
                              {row.entry.changedByName ?? row.entry.changedBy}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {row.entry.source}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.entry.notes ?? "–"}
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <HistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        entityType="Product"
        entityId={params.id}
        title={`History – ${product.sku}`}
      />
    </div>
  );
}
