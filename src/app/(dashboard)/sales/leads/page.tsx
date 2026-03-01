"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, LayoutGrid, List, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const;

interface LeadItem {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string;
  value: number | null;
  assignee: { id: string; name: string } | null;
}

export default function LeadsPage() {
  const t = useTranslations("leads");
  const router = useRouter();
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"pipeline" | "list">("list");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formSource, setFormSource] = useState("");
  const [formStatus, setFormStatus] = useState<string>("NEW");
  const [formAssignedTo, setFormAssignedTo] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/leads?pageSize=500");
      const json = await res.json();
      if (json.success) setLeads(json.data?.items ?? []);
    } catch {
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/users?pageSize=200");
    const json = await res.json();
    if (json.success && json.data?.items) setUsers(json.data.items);
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchUsers();
  }, [fetchLeads, fetchUsers]);

  const openCreate = () => {
    setEditingId(null);
    setFormName("");
    setFormCompany("");
    setFormPhone("");
    setFormEmail("");
    setFormSource("");
    setFormStatus("NEW");
    setFormAssignedTo("");
    setFormValue("");
    setFormNotes("");
    setDialogOpen(true);
  };

  const openEdit = (lead: LeadItem) => {
    setEditingId(lead.id);
    setFormName(lead.name);
    setFormCompany(lead.company ?? "");
    setFormPhone(lead.phone ?? "");
    setFormEmail(lead.email ?? "");
    setFormSource(lead.source ?? "");
    setFormStatus(lead.status);
    setFormAssignedTo(lead.assignee?.id ?? "");
    setFormValue(lead.value != null ? String(lead.value) : "");
    setFormNotes("");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: formName.trim(),
        company: formCompany.trim() || null,
        phone: formPhone.trim() || null,
        email: formEmail.trim() || null,
        source: formSource.trim() || null,
        status: formStatus,
        assignedTo: formAssignedTo || null,
        value: formValue ? parseFloat(formValue) : null,
        notes: formNotes.trim() || null,
      };
      const url = editingId ? `/api/leads/${editingId}` : "/api/leads";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editingId ? "Lead updated" : "Lead created");
        setDialogOpen(false);
        fetchLeads();
      } else {
        toast.error(json.error ?? "Failed to save");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (leadId: string) => {
    if (!confirm("Delete this lead?")) return;
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success("Lead deleted");
        fetchLeads();
      } else {
        toast.error(json.error ?? "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const formatCurrency = (val: number | null) =>
    val != null
      ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val)
      : "-";

  const columns: ColumnDef<LeadItem>[] = [
    {
      accessorKey: "name",
      header: t("name"),
      cell: ({ row }) => (
        <button
          className="font-medium text-primary hover:underline"
          onClick={() => router.push(`/sales/leads/${row.original.id}`)}
        >
          {row.original.name}
        </button>
      ),
    },
    { accessorKey: "company", header: t("company"), cell: ({ row }) => row.original.company ?? "-" },
    { accessorKey: "phone", header: t("phone"), cell: ({ row }) => row.original.phone ?? "-" },
    { accessorKey: "email", header: t("email"), cell: ({ row }) => row.original.email ?? "-" },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => <StatusBadge status={row.original.status.toLowerCase()} />,
    },
    {
      id: "assignee",
      header: t("assignedTo"),
      cell: ({ row }) => row.original.assignee?.name ?? "-",
    },
    {
      id: "value",
      header: t("value"),
      cell: ({ row }) => formatCurrency(row.original.value),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(row.original.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const byStatus = LEAD_STATUSES.map((status) => ({
    status,
    leads: leads.filter((l) => l.status === status),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "list" ? "pipeline" : "list")}>
              {viewMode === "list" ? <LayoutGrid className="mr-2 h-4 w-4" /> : <List className="mr-2 h-4 w-4" />}
              {viewMode === "list" ? t("pipeline") : t("list")}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addLead")}
            </Button>
          </>
        }
      />

      {viewMode === "pipeline" ? (
        <div className="grid gap-4 overflow-x-auto pb-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {byStatus.map(({ status, leads: statusLeads }) => (
            <Card key={status} className="min-w-[260px]">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t(status.toLowerCase() as "new")}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{statusLeads.length}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {statusLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-lg border bg-card p-3 shadow-sm hover:bg-muted/30 cursor-pointer"
                    onClick={() => router.push(`/sales/leads/${lead.id}`)}
                  >
                    <p className="font-medium truncate">{lead.name}</p>
                    {lead.company && <p className="text-xs text-muted-foreground truncate">{lead.company}</p>}
                    {lead.value != null && (
                      <p className="text-xs font-medium text-primary mt-1">{formatCurrency(lead.value)}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            {leads.length === 0 && !loading ? (
              <p className="text-center text-muted-foreground py-8">{t("noLeads")}</p>
            ) : (
              <DataTable
                columns={columns}
                data={leads}
                searchKey="name"
                searchPlaceholder={`${t("name")}...`}
                isLoading={loading}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Lead" : t("addLead")}</DialogTitle>
            <DialogDescription>{editingId ? "Update lead details." : "Add a new lead to the pipeline."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>{t("name")} *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Lead name" />
            </div>
            <div>
              <Label>{t("company")}</Label>
              <Input value={formCompany} onChange={(e) => setFormCompany(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("phone")}</Label>
                <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
              </div>
              <div>
                <Label>{t("email")}</Label>
                <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{t("source")}</Label>
              <Input value={formSource} onChange={(e) => setFormSource(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("status")}</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{t(s.toLowerCase() as "new")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("assignedTo")}</Label>
                <Select value={formAssignedTo} onValueChange={setFormAssignedTo}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("value")}</Label>
              <Input type="number" value={formValue} onChange={(e) => setFormValue(e.target.value)} placeholder="0" />
            </div>
            {editingId && (
              <div>
                <Label>{t("notes")}</Label>
                <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>{editingId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
