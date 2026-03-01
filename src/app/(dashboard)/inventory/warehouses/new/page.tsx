"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";

export default function NewWarehousePage() {
  const t = useTranslations("warehouse");
  const tc = useTranslations("common");
  const router = useRouter();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("nameRequired"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || undefined,
          isDefault,
          isActive,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t("createSuccess"));
        router.push(`/inventory/warehouses/${json.data.id}`);
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error("Failed to create warehouse");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("addWarehouse")}
        actions={
          <Button
            variant="outline"
            onClick={() => router.push("/inventory/warehouses")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tc("back")}
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">{t("address")}</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t("addressPlaceholder")}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="isDefault">{t("defaultWarehouse")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("defaultWarehouseHint")}
                </p>
              </div>
              <Switch
                id="isDefault"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="isActive">{t("active")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("activeHint")}
                </p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? tc("loading") : tc("save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/inventory/warehouses")}
              >
                {tc("cancel")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
