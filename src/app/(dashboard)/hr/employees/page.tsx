"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Employee {
  id: string;
  name: string;
  nik: string | null;
  department: string | null;
  position: string | null;
  joinDate: string | null;
  basicSalary: number;
  allowances: number;
  deductions: number;
  employmentType: string;
  status: string;
  user?: { id: string; name: string; email: string } | null;
}

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default function EmployeesPage() {
  const t = useTranslations("employees");
  const tc = useTranslations("common");
  const tVal = useTranslations("validation");
  const router = useRouter();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    nik: "",
    department: "",
    position: "",
    joinDate: "",
    basicSalary: "",
    allowances: "",
    deductions: "",
    employmentType: "PERMANENT",
    phone: "",
    email: "",
    address: "",
    bankAccount: "",
    bankName: "",
    status: "ACTIVE",
  });

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/employees?page=1&pageSize=500");
      const json = await res.json();
      if (json.success) setEmployees(json.data?.items ?? []);
    } catch {
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const openCreate = () => {
    setEditingId(null);
    setFormData({
      name: "",
      nik: "",
      department: "",
      position: "",
      joinDate: "",
      basicSalary: "",
      allowances: "0",
      deductions: "0",
      employmentType: "PERMANENT",
      phone: "",
      email: "",
      address: "",
      bankAccount: "",
      bankName: "",
      status: "ACTIVE",
    });
    setFormOpen(true);
  };

  const openEdit = async (emp: Employee) => {
    setEditingId(emp.id);
    try {
      const res = await fetch(`/api/employees/${emp.id}`);
      const json = await res.json();
      if (!json.success) {
        toast.error("Failed to load employee");
        return;
      }
      const e = json.data as {
        name: string; nik: string | null; department: string | null; position: string | null;
        joinDate: string | null; basicSalary: number; allowances: number; deductions: number;
        employmentType: string; phone: string | null; email: string | null; address: string | null;
        bankAccount: string | null; bankName: string | null; status: string;
      };
      setFormData({
        name: e.name,
        nik: e.nik ?? "",
        department: e.department ?? "",
        position: e.position ?? "",
        joinDate: e.joinDate ? e.joinDate.slice(0, 10) : "",
        basicSalary: String(e.basicSalary),
        allowances: String(e.allowances),
        deductions: String(e.deductions),
        employmentType: e.employmentType,
        phone: e.phone ?? "",
        email: e.email ?? "",
        address: e.address ?? "",
        bankAccount: e.bankAccount ?? "",
        bankName: e.bankName ?? "",
        status: e.status,
      });
      setFormOpen(true);
    } catch {
      toast.error("Failed to load employee");
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error(tVal("required"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        nik: formData.nik.trim() || null,
        department: formData.department.trim() || null,
        position: formData.position.trim() || null,
        joinDate: formData.joinDate || null,
        basicSalary: Number(formData.basicSalary) || 0,
        allowances: Number(formData.allowances) || 0,
        deductions: Number(formData.deductions) || 0,
        employmentType: formData.employmentType,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        bankAccount: formData.bankAccount.trim() || null,
        bankName: formData.bankName.trim() || null,
        status: formData.status,
      };
      const url = editingId ? `/api/employees/${editingId}` : "/api/employees";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editingId ? t("updateSuccess") : t("createSuccess"));
        setFormOpen(false);
        fetchEmployees();
      } else {
        toast.error(json.error ?? "Failed to save");
      }
    } catch {
      toast.error("Failed to save employee");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/employees/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success(t("deleteSuccess"));
        setEmployees((prev) => prev.filter((e) => e.id !== deleteId));
        setDeleteId(null);
      } else {
        toast.error(json.error ?? "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<Employee, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: t("name"),
        cell: ({ row }) => (
          <button
            type="button"
            className="text-primary hover:underline text-left font-medium"
            onClick={() => router.push(`/hr/employees/${row.original.id}`)}
          >
            {row.original.name}
          </button>
        ),
      },
      { accessorKey: "nik", header: t("nik"), cell: ({ row }) => row.original.nik ?? "—" },
      { accessorKey: "department", header: t("department"), cell: ({ row }) => row.original.department ?? "—" },
      { accessorKey: "position", header: t("position"), cell: ({ row }) => row.original.position ?? "—" },
      {
        accessorKey: "basicSalary",
        header: t("basicSalary"),
        cell: ({ row }) => formatIDR(row.original.basicSalary),
      },
      {
        accessorKey: "status",
        header: t("status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: tc("actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setDeleteId(row.original.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [t, tc, router]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addEmployee")}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={employees}
        searchKey="name"
        searchPlaceholder={t("searchPlaceholder")}
        isLoading={loading}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t("editEmployee") : t("addEmployee")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>{t("name")} *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder={t("name")}
                />
              </div>
              <div>
                <Label>{t("nik")}</Label>
                <Input value={formData.nik} onChange={(e) => setFormData((p) => ({ ...p, nik: e.target.value }))} placeholder="NIK" />
              </div>
              <div>
                <Label>{t("department")}</Label>
                <Input value={formData.department} onChange={(e) => setFormData((p) => ({ ...p, department: e.target.value }))} />
              </div>
              <div>
                <Label>{t("position")}</Label>
                <Input value={formData.position} onChange={(e) => setFormData((p) => ({ ...p, position: e.target.value }))} />
              </div>
              <div>
                <Label>{t("joinDate")}</Label>
                <Input
                  type="date"
                  value={formData.joinDate}
                  onChange={(e) => setFormData((p) => ({ ...p, joinDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("employmentType")}</Label>
                <Select value={formData.employmentType} onValueChange={(v) => setFormData((p) => ({ ...p, employmentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERMANENT">{t("permanent")}</SelectItem>
                    <SelectItem value="CONTRACT">{t("contract")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("basicSalary")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.basicSalary}
                  onChange={(e) => setFormData((p) => ({ ...p, basicSalary: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("allowances")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.allowances}
                  onChange={(e) => setFormData((p) => ({ ...p, allowances: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("deductions")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.deductions}
                  onChange={(e) => setFormData((p) => ({ ...p, deductions: e.target.value }))}
                />
              </div>
              {editingId && (
                <div>
                  <Label>{t("status")}</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData((p) => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">{t("active")}</SelectItem>
                      <SelectItem value="RESIGNED">{t("resigned")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="col-span-2">
                <Label>{t("email")}</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <Label>{t("phone")}</Label>
                <Input value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <Label>{t("bankName")}</Label>
                <Input value={formData.bankName} onChange={(e) => setFormData((p) => ({ ...p, bankName: e.target.value }))} />
              </div>
              <div>
                <Label>{t("bankAccount")}</Label>
                <Input value={formData.bankAccount} onChange={(e) => setFormData((p) => ({ ...p, bankAccount: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>{t("address")}</Label>
                <Input value={formData.address} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? tc("loading") : tc("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tc("delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>{deleting ? tc("loading") : tc("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
