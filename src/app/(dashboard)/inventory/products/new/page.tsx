"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";

/**
 * New product creation page.
 * Renders a form with all product fields. On successful creation
 * the user is redirected to the product detail page.
 */
export default function NewProductPage() {
  const router = useRouter();
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const [saving, setSaving] = useState(false);

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

  const handleCreate = async () => {
    if (!form.sku.trim() || !form.name.trim()) {
      toast.error("SKU and Name are required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
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
        toast.success("Product created");
        router.push(`/inventory/products/${json.data.id}`);
      } else {
        toast.error(json.error ?? "Failed to create product");
      }
    } catch {
      toast.error("Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("addProduct")}
        actions={
          <Button variant="outline" onClick={() => router.push("/inventory/products")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tCommon("back")}
          </Button>
        }
      />

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sku">{t("sku")} *</Label>
              <Input
                id="sku"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="e.g. PRD-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")} *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Product name"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">{t("description")}</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">{t("category")}</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">{t("brand")}</Label>
              <Input
                id="brand"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseUom">{t("uom")}</Label>
              <Input
                id="baseUom"
                value={form.baseUom}
                onChange={(e) => setForm({ ...form, baseUom: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capitalCost">{t("capitalCost")}</Label>
              <Input
                id="capitalCost"
                type="number"
                min={0}
                value={form.capitalCost}
                onChange={(e) => setForm({ ...form, capitalCost: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellPrice">{t("sellPrice")}</Label>
              <Input
                id="sellPrice"
                type="number"
                min={0}
                value={form.sellPrice}
                onChange={(e) => setForm({ ...form, sellPrice: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minStock">{t("minStock")}</Label>
              <Input
                id="minStock"
                type="number"
                min={0}
                value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxStock">{t("maxStock")}</Label>
              <Input
                id="maxStock"
                type="number"
                min={0}
                value={form.maxStock}
                onChange={(e) => setForm({ ...form, maxStock: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label htmlFor="isActive">{t("active")}</Label>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleCreate} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? tCommon("loading") : tCommon("create")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
