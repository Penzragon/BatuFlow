"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Save, MapPin } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Page for creating a new customer record.
 * Redirects to the detail page on successful creation.
 */
export default function NewCustomerPage() {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    taxId: "",
    paymentTermsDays: 30,
    salespersonId: "",
    region: "",
    tier: "",
    gpsLatitude: "",
    gpsLongitude: "",
    isActive: true,
  });

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        address: form.address || undefined,
        phone: form.phone || undefined,
        email: form.email || "",
        taxId: form.taxId || undefined,
        paymentTermsDays: form.paymentTermsDays,
        salespersonId: form.salespersonId || undefined,
        region: form.region || undefined,
        tier: form.tier || undefined,
        gpsLatitude: form.gpsLatitude
          ? parseFloat(form.gpsLatitude)
          : undefined,
        gpsLongitude: form.gpsLongitude
          ? parseFloat(form.gpsLongitude)
          : undefined,
        isActive: form.isActive,
      };

      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        toast.success("Customer created");
        router.push(`/sales/customers/${json.data.id}`);
      } else {
        toast.error(json.error || "Failed to create customer");
      }
    } catch {
      toast.error("Failed to create customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("addCustomer")}
        actions={
          <Button
            variant="outline"
            onClick={() => router.push("/sales/customers")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tc("back")}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("addCustomer")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")} *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="+62 xxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="customer@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxId">{t("taxId")}</Label>
              <Input
                id="taxId"
                value={form.taxId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, taxId: e.target.value }))
                }
                placeholder="NPWP"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentTermsDays">{t("paymentTerms")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="paymentTermsDays"
                  type="number"
                  min={0}
                  value={form.paymentTermsDays}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      paymentTermsDays: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">{t("region")}</Label>
              <Input
                id="region"
                value={form.region}
                onChange={(e) =>
                  setForm((f) => ({ ...f, region: e.target.value }))
                }
                placeholder="e.g. West Java"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier">{t("tier")}</Label>
              <Input
                id="tier"
                value={form.tier}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tier: e.target.value }))
                }
                placeholder="e.g. Gold, Silver"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salespersonId">Salesperson ID</Label>
              <Input
                id="salespersonId"
                value={form.salespersonId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, salespersonId: e.target.value }))
                }
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">{t("address")}</Label>
            <Textarea
              id="address"
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
              rows={3}
              placeholder="Full address"
            />
          </div>

          {/* GPS Coordinates */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <Label>{t("gpsCoordinates")}</Label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gpsLatitude" className="text-xs text-muted-foreground">
                  Latitude
                </Label>
                <Input
                  id="gpsLatitude"
                  type="number"
                  step="any"
                  value={form.gpsLatitude}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, gpsLatitude: e.target.value }))
                  }
                  placeholder="-6.2088"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gpsLongitude" className="text-xs text-muted-foreground">
                  Longitude
                </Label>
                <Input
                  id="gpsLongitude"
                  type="number"
                  step="any"
                  value={form.gpsLongitude}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, gpsLongitude: e.target.value }))
                  }
                  placeholder="106.8456"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Map picker will be available when Google Maps API key is
              configured.
            </p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <Switch
              checked={form.isActive}
              onCheckedChange={(checked) =>
                setForm((f) => ({ ...f, isActive: checked }))
              }
            />
            <Label>
              {form.isActive ? "Active" : "Inactive"}
            </Label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => router.push("/sales/customers")}
            >
              {tc("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? tc("loading") : tc("create")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
