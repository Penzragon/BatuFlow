"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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

interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  employee?: { name: string; department?: string };
}

export default function LeavePage() {
  const t = useTranslations("leave");
  const tc = useTranslations("common");

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [formOpen, setFormOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: "",
    leaveType: "ANNUAL",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/leave-requests?${params}`);
      const json = await res.json();
      if (json.success) setRequests(json.data?.items ?? []);
    } catch {
      toast.error("Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchEmployees = useCallback(async () => {
    const res = await fetch("/api/employees?pageSize=500");
    const json = await res.json();
    if (json.success) setEmployees(json.data?.items ?? []);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/leave-requests/${id}/approve`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success(t("approveSuccess"));
        fetchRequests();
      } else {
        toast.error(json.error ?? "Failed to approve");
      }
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leave-requests/${rejectId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason || "Rejected" }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t("rejectSuccess"));
        setRejectId(null);
        setRejectReason("");
        fetchRequests();
      } else {
        toast.error(json.error ?? "Failed to reject");
      }
    } catch {
      toast.error("Failed to reject");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!formData.employeeId || !formData.startDate || !formData.endDate) {
      toast.error("Fill required fields");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: formData.employeeId,
          leaveType: formData.leaveType,
          startDate: formData.startDate,
          endDate: formData.endDate,
          reason: formData.reason || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Leave request created");
        setFormOpen(false);
        setFormData({ employeeId: "", leaveType: "ANNUAL", startDate: "", endDate: "", reason: "" });
        fetchRequests();
      } else {
        toast.error(json.error ?? "Failed to create");
      }
    } catch {
      toast.error("Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<LeaveRequest, unknown>[] = [
    { accessorKey: "employeeName", accessorFn: (row) => row.employee?.name ?? "", header: t("employee"), cell: ({ row }) => row.original.employee?.name ?? "—" },
    { accessorKey: "leaveType", header: t("leaveType") },
    { accessorKey: "startDate", header: t("startDate"), cell: ({ row }) => row.original.startDate?.slice(0, 10) },
    { accessorKey: "endDate", header: t("endDate"), cell: ({ row }) => row.original.endDate?.slice(0, 10) },
    { accessorKey: "days", header: t("days") },
    { accessorKey: "status", header: t("status"), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: "actions",
      header: tc("actions"),
      cell: ({ row }) =>
        row.original.status === "PENDING" ? (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => handleApprove(row.original.id)}>
              <Check className="h-4 w-4 mr-1" />
              {t("approve")}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setRejectId(row.original.id)}>
              <X className="h-4 w-4 mr-1" />
              {t("reject")}
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("requestLeave")}
          </Button>
        }
      />

      <div className="flex gap-2 items-center">
        <Label>{t("status")}:</Label>
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t("status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="PENDING">{t("pending")}</SelectItem>
            <SelectItem value="APPROVED">{t("approved")}</SelectItem>
            <SelectItem value="REJECTED">{t("rejected")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={requests}
        searchKey="employeeName"
        searchPlaceholder={t("searchPlaceholder")}
        isLoading={loading}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("requestLeave")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>{t("employee")} *</Label>
              <Select value={formData.employeeId} onValueChange={(v) => setFormData((p) => ({ ...p, employeeId: v }))}>
                <SelectTrigger><SelectValue placeholder={t("employee")} /></SelectTrigger>
                <SelectContent>
                  {(employees ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("leaveType")}</Label>
              <Select value={formData.leaveType} onValueChange={(v) => setFormData((p) => ({ ...p, leaveType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANNUAL">{t("annual")}</SelectItem>
                  <SelectItem value="SICK">{t("sick")}</SelectItem>
                  <SelectItem value="PERSONAL">{t("personal")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("startDate")} *</Label>
                <Input type="date" value={formData.startDate} onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>{t("endDate")} *</Label>
                <Input type="date" value={formData.endDate} onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>{t("reason")}</Label>
              <Textarea value={formData.reason} onChange={(e) => setFormData((p) => ({ ...p, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleSubmitRequest} disabled={saving}>{saving ? tc("loading") : tc("submit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("reject")}</AlertDialogTitle>
            <AlertDialogDescription>{t("rejectionReason")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder={t("rejectionReason")}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={saving}>{saving ? tc("loading") : t("reject")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
