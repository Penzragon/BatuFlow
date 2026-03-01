"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";

interface HandoverItem {
  id: string;
  status: string;
  trip: { id: string; tripNumber: string; tripDate: string };
  warehouseStaff: { id: string; name: string };
  driver: { id: string; name: string };
  _count: { lines: number };
  createdAt: string;
}

interface Trip { id: string; tripNumber: string; }

export default function HandoversPage() {
  const t = useTranslations("handovers");
  const tc = useTranslations("common");
  const router = useRouter();

  const [items, setItems] = useState<HandoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState("");

  const fetchHandovers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/handovers?pageSize=200");
      const data = await res.json();
      if (data.success) setItems(data.data.items);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, []);

  const fetchTrips = useCallback(async () => {
    try {
      const res = await fetch("/api/trips?pageSize=200&status=PLANNED");
      const data = await res.json();
      if (data.success) setTrips(data.data.items);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchHandovers(); fetchTrips(); }, [fetchHandovers, fetchTrips]);

  const handleSubmit = async () => {
    if (!selectedTrip) return toast.error("Trip is required");
    setSubmitting(true);
    try {
      const res = await fetch("/api/handovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: selectedTrip }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(t("created"));
      setFormOpen(false);
      fetchHandovers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setSubmitting(false); }
  };

  const columns: ColumnDef<HandoverItem>[] = [
    {
      id: "tripNumber",
      accessorFn: (row) => row.trip?.tripNumber ?? "",
      header: t("trip"),
      cell: ({ row }) => (
        <button className="font-mono text-sm font-medium text-primary underline" onClick={() => router.push(`/inventory/handovers/${row.original.id}`)}>
          {row.original.trip.tripNumber}
        </button>
      ),
    },
    { id: "warehouseStaff", accessorFn: (row) => row.warehouseStaff?.name ?? "", header: t("warehouseStaff"), cell: ({ row }) => row.original.warehouseStaff.name },
    { id: "driver", accessorFn: (row) => row.driver?.name ?? "", header: t("driver"), cell: ({ row }) => row.original.driver.name },
    { accessorKey: "status", header: t("status"), cell: ({ row }) => <StatusBadge status={row.original.status.toLowerCase()} /> },
    { id: "lines", accessorFn: (row) => row._count?.lines ?? 0, header: "DOs", cell: ({ row }) => row.original._count.lines },
    { accessorKey: "createdAt", header: "Date", cell: ({ row }) => format(new Date(row.original.createdAt), "dd/MM/yyyy HH:mm") },
  ];

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={
        <Button onClick={() => { setSelectedTrip(""); setFormOpen(true); }}>
          <Plus size={16} className="mr-1" />{t("createHandover")}
        </Button>
      } />
      <div className="p-6">
        <DataTable columns={columns} data={items} isLoading={loading} searchKey="tripNumber" />
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createHandover")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("selectTrip")}</Label>
              <Select value={selectedTrip} onValueChange={setSelectedTrip}>
                <SelectTrigger><SelectValue placeholder={t("selectTrip")} /></SelectTrigger>
                <SelectContent>
                  {trips.map(trip => <SelectItem key={trip.id} value={trip.id}>{trip.tripNumber}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting ? tc("loading") : tc("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
