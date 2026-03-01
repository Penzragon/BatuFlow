"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";

interface Vehicle {
  id: string;
  plateNumber: string;
  vehicleType: "TRUCK" | "VAN" | "MOTORCYCLE";
  capacity: number | null;
  status: "AVAILABLE" | "IN_USE" | "MAINTENANCE";
  notes: string | null;
  createdAt: string;
}

interface VehicleForm {
  plateNumber: string;
  vehicleType: "TRUCK" | "VAN" | "MOTORCYCLE";
  capacity: string;
  status: "AVAILABLE" | "IN_USE" | "MAINTENANCE";
  notes: string;
}

const defaultForm: VehicleForm = {
  plateNumber: "",
  vehicleType: "VAN",
  capacity: "",
  status: "AVAILABLE",
  notes: "",
};

export default function VehiclesPage() {
  const t = useTranslations("vehicles");
  const tc = useTranslations("common");

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleForm>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vehicles?pageSize=200");
      const data = await res.json();
      if (data.success) setVehicles(data.data.items);
    } catch {
      toast.error("Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const openAdd = () => {
    setEditingId(null);
    setForm(defaultForm);
    setFormOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditingId(v.id);
    setForm({
      plateNumber: v.plateNumber,
      vehicleType: v.vehicleType,
      capacity: v.capacity ? String(v.capacity) : "",
      status: v.status,
      notes: v.notes ?? "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.plateNumber.trim()) return toast.error("Plate number is required");
    setSubmitting(true);
    try {
      const payload = {
        plateNumber: form.plateNumber,
        vehicleType: form.vehicleType,
        capacity: form.capacity ? parseFloat(form.capacity) : undefined,
        status: editingId ? form.status : undefined,
        notes: form.notes || undefined,
      };
      const url = editingId ? `/api/vehicles/${editingId}` : "/api/vehicles";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(editingId ? t("updated") : t("created"));
      setFormOpen(false);
      fetchVehicles();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/vehicles/${deleteId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(t("deleted"));
      setDeleteId(null);
      fetchVehicles();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const vehicleTypeLabel: Record<string, string> = { TRUCK: t("truck"), VAN: t("van"), MOTORCYCLE: t("motorcycle") };
  const statusLabel: Record<string, string> = { AVAILABLE: t("available"), IN_USE: t("inUse"), MAINTENANCE: t("maintenance") };

  const columns: ColumnDef<Vehicle>[] = [
    {
      accessorKey: "plateNumber",
      header: t("plateNumber"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 font-medium">
          <Truck size={14} className="text-muted-foreground" />
          {row.original.plateNumber}
        </div>
      ),
    },
    {
      accessorKey: "vehicleType",
      header: t("vehicleType"),
      cell: ({ row }) => vehicleTypeLabel[row.original.vehicleType] ?? row.original.vehicleType,
    },
    {
      accessorKey: "capacity",
      header: t("capacity"),
      cell: ({ row }) => row.original.capacity ? `${row.original.capacity} kg` : "—",
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => <StatusBadge status={row.original.status.toLowerCase().replace("_", "-")} />,
    },
    {
      accessorKey: "notes",
      header: t("notes"),
      cell: ({ row }) => row.original.notes ?? "—",
    },
    {
      id: "actions",
      header: tc("actions"),
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)}>
            <Pencil size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(row.original.id)}>
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={openAdd}>
            <Plus size={16} className="mr-1" />
            {t("addVehicle")}
          </Button>
        }
      />

      <div className="p-6">
        <DataTable
          columns={columns}
          data={vehicles}
          isLoading={loading}
          searchKey="plateNumber"
        />
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t("editVehicle") : t("addVehicle")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("plateNumber")}</Label>
              <Input
                value={form.plateNumber}
                onChange={(e) => setForm({ ...form, plateNumber: e.target.value.toUpperCase() })}
                placeholder="B 1234 ABC"
              />
            </div>
            <div>
              <Label>{t("vehicleType")}</Label>
              <Select value={form.vehicleType} onValueChange={(v) => setForm({ ...form, vehicleType: v as VehicleForm["vehicleType"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRUCK">{t("truck")}</SelectItem>
                  <SelectItem value="VAN">{t("van")}</SelectItem>
                  <SelectItem value="MOTORCYCLE">{t("motorcycle")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("capacity")}</Label>
              <Input
                type="number"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                placeholder="1000"
              />
            </div>
            {editingId && (
              <div>
                <Label>{t("status")}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as VehicleForm["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">{t("available")}</SelectItem>
                    <SelectItem value="IN_USE">{t("inUse")}</SelectItem>
                    <SelectItem value="MAINTENANCE">{t("maintenance")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>{t("notes")}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? tc("loading") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tc("delete")}</DialogTitle>
            <DialogDescription>{t("confirmDelete")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{tc("cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete}>{tc("delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
