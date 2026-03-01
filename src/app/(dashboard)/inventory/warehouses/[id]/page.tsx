"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";

interface Warehouse {
  id: string;
  name: string;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
  locations: Location[];
}

interface Location {
  id: string;
  warehouseId: string;
  name: string;
  description: string | null;
  zone: string | null;
}

export default function WarehouseDetailPage() {
  const t = useTranslations("warehouse");
  const tc = useTranslations("common");
  const router = useRouter();
  const params = useParams();
  const warehouseId = params.id as string;

  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Detail form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Location inline editing
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editZone, setEditZone] = useState("");

  // New location
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newLocDescription, setNewLocDescription] = useState("");
  const [newLocZone, setNewLocZone] = useState("");

  const [deleteLocId, setDeleteLocId] = useState<string | null>(null);

  const fetchWarehouse = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/warehouses/${warehouseId}`);
      const json = await res.json();
      if (json.success) {
        const wh = json.data as Warehouse;
        setWarehouse(wh);
        setName(wh.name);
        setAddress(wh.address ?? "");
        setIsDefault(wh.isDefault);
        setIsActive(wh.isActive);
      } else {
        toast.error(json.error);
        router.push("/inventory/warehouses");
      }
    } catch {
      toast.error("Failed to load warehouse");
    } finally {
      setIsLoading(false);
    }
  }, [warehouseId, router]);

  useEffect(() => {
    fetchWarehouse();
  }, [fetchWarehouse]);

  /** Save warehouse details */
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/warehouses/${warehouseId}`, {
        method: "PUT",
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
        toast.success(t("updateSuccess"));
        fetchWarehouse();
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error("Failed to update warehouse");
    } finally {
      setSaving(false);
    }
  };

  /** Create a new location */
  const handleAddLocation = async () => {
    if (!newLocName.trim()) return;
    try {
      const res = await fetch(`/api/warehouses/${warehouseId}/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newLocName.trim(),
          description: newLocDescription.trim() || undefined,
          zone: newLocZone.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t("locationCreated"));
        setAddingLocation(false);
        setNewLocName("");
        setNewLocDescription("");
        setNewLocZone("");
        fetchWarehouse();
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error("Failed to create location");
    }
  };

  /** Start inline edit for a location row */
  const startEditLocation = (loc: Location) => {
    setEditingLocation(loc.id);
    setEditName(loc.name);
    setEditDescription(loc.description ?? "");
    setEditZone(loc.zone ?? "");
  };

  /** Save inline edited location */
  const handleSaveLocation = async () => {
    if (!editingLocation || !editName.trim()) return;
    try {
      const res = await fetch(
        `/api/warehouses/${warehouseId}/locations/${editingLocation}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            description: editDescription.trim() || undefined,
            zone: editZone.trim() || undefined,
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        toast.success(t("locationUpdated"));
        setEditingLocation(null);
        fetchWarehouse();
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error("Failed to update location");
    }
  };

  /** Delete a location */
  const handleDeleteLocation = async () => {
    if (!deleteLocId) return;
    try {
      const res = await fetch(
        `/api/warehouses/${warehouseId}/locations/${deleteLocId}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (json.success) {
        toast.success(t("locationDeleted"));
        fetchWarehouse();
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error("Failed to delete location");
    } finally {
      setDeleteLocId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!warehouse) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={warehouse.name}
        description={warehouse.address ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            {warehouse.isDefault && (
              <Badge variant="default">{t("defaultWarehouse")}</Badge>
            )}
            <Button
              variant="outline"
              onClick={() => router.push("/inventory/warehouses")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tc("back")}
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{t("details")}</TabsTrigger>
          <TabsTrigger value="locations">
            {t("locations")} ({warehouse.locations.length})
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSaveDetails} className="space-y-6 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("name")} *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">{t("address")}</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
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
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">{t("locations")}</h3>
                <Button
                  size="sm"
                  onClick={() => setAddingLocation(true)}
                  disabled={addingLocation}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("addLocation")}
                </Button>
              </div>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead>{t("description")}</TableHead>
                      <TableHead>{t("zone")}</TableHead>
                      <TableHead className="w-[100px]">{tc("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {addingLocation && (
                      <TableRow>
                        <TableCell>
                          <Input
                            value={newLocName}
                            onChange={(e) => setNewLocName(e.target.value)}
                            placeholder={t("name")}
                            autoFocus
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={newLocDescription}
                            onChange={(e) => setNewLocDescription(e.target.value)}
                            placeholder={t("description")}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={newLocZone}
                            onChange={(e) => setNewLocZone(e.target.value)}
                            placeholder={t("zone")}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={handleAddLocation}
                              disabled={!newLocName.trim()}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setAddingLocation(false);
                                setNewLocName("");
                                setNewLocDescription("");
                                setNewLocZone("");
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {warehouse.locations.length === 0 && !addingLocation ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="h-24 text-center text-muted-foreground"
                        >
                          {t("noLocations")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      warehouse.locations.map((loc) => (
                        <TableRow key={loc.id}>
                          <TableCell>
                            {editingLocation === loc.id ? (
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                autoFocus
                              />
                            ) : (
                              <span className="font-medium">{loc.name}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingLocation === loc.id ? (
                              <Input
                                value={editDescription}
                                onChange={(e) =>
                                  setEditDescription(e.target.value)
                                }
                              />
                            ) : (
                              <span className="text-muted-foreground">
                                {loc.description || "—"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingLocation === loc.id ? (
                              <Input
                                value={editZone}
                                onChange={(e) => setEditZone(e.target.value)}
                              />
                            ) : (
                              <span className="text-muted-foreground">
                                {loc.zone || "—"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingLocation === loc.id ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={handleSaveLocation}
                                  disabled={!editName.trim()}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setEditingLocation(null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => startEditLocation(loc)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteLocId(loc.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete location confirmation */}
      <AlertDialog open={!!deleteLocId} onOpenChange={() => setDeleteLocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDeleteLocation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteLocationDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteLocation}
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
