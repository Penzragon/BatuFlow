"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Eye, Calendar, User, Truck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ColumnDef } from "@tanstack/react-table";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface TripItem {
  id: string;
  tripNumber: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  tripDate: string;
  notes: string | null;
  driver: { id: string; name: string };
  vehicle: { id: string; plateNumber: string; vehicleType: string };
  _count: { deliveryOrders: number };
}

interface DriverOption { id: string; name: string; email: string }
interface VehicleOption { id: string; plateNumber: string; vehicleType: string }
interface DOOption {
  id: string;
  doNumber: string;
  salesOrder: { soNumber: string; customer: { name: string } };
}

export default function TripsPage() {
  const t = useTranslations("trips");
  const tc = useTranslations("common");
  const router = useRouter();

  const [trips, setTrips] = useState<TripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [availableDOs, setAvailableDOs] = useState<DOOption[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [tripDate, setTripDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedDOs, setSelectedDOs] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trips?pageSize=200");
      const data = await res.json();
      if (data.success) setTrips(data.data.items);
    } catch { toast.error("Failed to load trips"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  const fetchFormData = async () => {
    const [usersRes, vehiclesRes, dosRes] = await Promise.all([
      fetch("/api/users?role=DRIVER&pageSize=100"),
      fetch("/api/vehicles?pageSize=100"),
      fetch("/api/delivery-orders?status=CONFIRMED&pageSize=200"),
    ]);
    const [usersData, vehiclesData, dosData] = await Promise.all([
      usersRes.json(), vehiclesRes.json(), dosRes.json(),
    ]);
    if (usersData.success) setDrivers(usersData.data.items ?? []);
    if (vehiclesData.success) setVehicles(vehiclesData.data.items ?? []);
    if (dosData.success) {
      // Only show DOs not yet assigned to a trip
      const unassigned = dosData.data.items.filter((d: DOOption & { tripId?: string }) => !d.tripId);
      setAvailableDOs(unassigned);
    }
  };

  const openCreate = async () => {
    setSelectedDriverId("");
    setSelectedVehicleId("");
    setTripDate(format(new Date(), "yyyy-MM-dd"));
    setSelectedDOs([]);
    setNotes("");
    await fetchFormData();
    setCreateOpen(true);
  };

  const toggleDO = (id: string) => {
    setSelectedDOs((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    if (!selectedDriverId) return toast.error("Please select a driver");
    if (!selectedVehicleId) return toast.error("Please select a vehicle");
    if (selectedDOs.length === 0) return toast.error("Please select at least one delivery order");

    setSubmitting(true);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: selectedDriverId,
          vehicleId: selectedVehicleId,
          tripDate: new Date(tripDate).toISOString(),
          doIds: selectedDOs,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(t("created"));
      setCreateOpen(false);
      fetchTrips();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel: Record<string, string> = {
    PLANNED: t("planned"),
    IN_PROGRESS: t("inProgress"),
    COMPLETED: t("completed"),
  };

  const vehicleTypeLabel: Record<string, string> = { TRUCK: "Truck", VAN: "Van", MOTORCYCLE: "Motorcycle" };

  const columns: ColumnDef<TripItem>[] = [
    {
      accessorKey: "tripNumber",
      header: t("tripNumber"),
      cell: ({ row }) => <span className="font-mono font-medium">{row.original.tripNumber}</span>,
    },
    {
      accessorKey: "tripDate",
      header: t("tripDate"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm">
          <Calendar size={12} />
          {format(new Date(row.original.tripDate), "dd MMM yyyy")}
        </div>
      ),
    },
    {
      accessorKey: "driver",
      header: t("driver"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm">
          <User size={12} />
          {row.original.driver.name}
        </div>
      ),
    },
    {
      accessorKey: "vehicle",
      header: t("vehicle"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm">
          <Truck size={12} />
          {row.original.vehicle.plateNumber}
          <span className="text-muted-foreground">({vehicleTypeLabel[row.original.vehicle.vehicleType]})</span>
        </div>
      ),
    },
    {
      accessorKey: "_count",
      header: t("deliveryOrders"),
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original._count.deliveryOrders} DOs</Badge>
      ),
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => <StatusBadge status={row.original.status.toLowerCase().replace("_", "-")} />,
    },
    {
      id: "actions",
      header: tc("actions"),
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" onClick={() => router.push(`/delivery/trips/${row.original.id}`)}>
          <Eye size={14} />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} className="mr-1" />
            {t("createTrip")}
          </Button>
        }
      />

      <div className="p-6">
        <DataTable
          columns={columns}
          data={trips}
          isLoading={loading}
          searchKey="tripNumber"
        />
      </div>

      {/* Create Trip Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("createTrip")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("driver")}</Label>
                <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                  <SelectTrigger><SelectValue placeholder={t("selectDriver")} /></SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("vehicle")}</Label>
                <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                  <SelectTrigger><SelectValue placeholder={t("selectVehicle")} /></SelectTrigger>
                  <SelectContent>
                    {vehicles
                      .filter((v) => v.vehicleType !== undefined)
                      .map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.plateNumber} ({vehicleTypeLabel[v.vehicleType]})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("tripDate")}</Label>
              <Input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} />
            </div>
            <div>
              <Label className="mb-2 block">{t("availableDOs")}</Label>
              {availableDOs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No confirmed delivery orders available</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                  {availableDOs.map((dOrder) => (
                    <div key={dOrder.id} className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedDOs.includes(dOrder.id)}
                        onCheckedChange={() => toggleDO(dOrder.id)}
                      />
                      <div className="text-sm">
                        <span className="font-mono font-medium">{dOrder.doNumber}</span>
                        <span className="ml-2 text-muted-foreground">
                          {dOrder.salesOrder.customer.name} — SO: {dOrder.salesOrder.soNumber}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedDOs.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{selectedDOs.length} selected</p>
              )}
            </div>
            <div>
              <Label>{t("notes")}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? tc("loading") : t("createTrip")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
