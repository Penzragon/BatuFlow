"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SummaryRow {
  employeeId: string;
  employeeName: string;
  present: number;
  late: number;
  absent: number;
  halfDay: number;
  days: Array<{ date: string; status: string; clockIn?: string; clockOut?: string }>;
}

export default function AttendancePage() {
  const t = useTranslations("attendance");
  const tc = useTranslations("common");

  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [summary, setSummary] = useState<{
    byEmployee: SummaryRow[];
    totalPresent: number;
    totalLate: number;
    totalAbsent: number;
    totalHalfDay: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    clockIn: "",
    clockOut: "",
    status: "PRESENT",
    notes: "",
  });

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/summary?month=${month}&year=${year}`);
      const json = await res.json();
      if (json.success) setSummary(json.data);
      else setSummary(null);
    } catch {
      toast.error("Failed to load attendance");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  const fetchEmployees = useCallback(async () => {
    const res = await fetch("/api/employees?pageSize=500");
    const json = await res.json();
    if (json.success) setEmployees(json.data?.items ?? []);
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handleSubmitRecord = async () => {
    if (!formData.employeeId) {
      toast.error("Select employee");
      return;
    }
    setSaving(true);
    try {
      const clockIn = formData.clockIn ? `${formData.date}T${formData.clockIn}:00` : null;
      const clockOut = formData.clockOut ? `${formData.date}T${formData.clockOut}:00` : null;
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: formData.employeeId,
          date: formData.date,
          clockIn,
          clockOut,
          status: formData.status,
          notes: formData.notes || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Attendance recorded");
        setFormOpen(false);
        fetchSummary();
      } else {
        toast.error(json.error ?? "Failed to save");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const getDayStatus = (row: SummaryRow, day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return row.days.find((d) => d.date === dateStr);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("recordAttendance")}
          </Button>
        }
      />

      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold min-w-[180px] text-center">
          {format(new Date(year, month - 1, 1), "MMMM yyyy")}
        </h2>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>{t("monthlySummary")}</CardTitle>
            <div className="flex gap-4 text-sm">
              <span>{t("totalPresent")}: {summary.totalPresent}</span>
              <span>{t("totalLate")}: {summary.totalLate}</span>
              <span>{t("totalAbsent")}: {summary.totalAbsent}</span>
              <span>{t("totalHalfDay")}: {summary.totalHalfDay}</span>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <p>{tc("loading")}</p>
            ) : !summary.byEmployee?.length ? (
              <p className="text-muted-foreground">{t("noRecords")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px] sticky left-0 bg-background">{t("employee")}</TableHead>
                    {dayHeaders.map((d) => (
                      <TableHead key={d} className="text-center w-10 px-1">{d}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(summary.byEmployee ?? []).map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell className="font-medium sticky left-0 bg-background">{row.employeeName}</TableCell>
                      {dayHeaders.map((day) => {
                        const rec = getDayStatus(row, day);
                        return (
                          <TableCell key={day} className="text-center p-1">
                            {rec ? (
                              <StatusBadge status={rec.status} />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("manualEntry")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>{t("employee")}</Label>
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
              <Label>{t("date")}</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("clockIn")}</Label>
                <Input
                  type="time"
                  value={formData.clockIn}
                  onChange={(e) => setFormData((p) => ({ ...p, clockIn: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("clockOut")}</Label>
                <Input
                  type="time"
                  value={formData.clockOut}
                  onChange={(e) => setFormData((p) => ({ ...p, clockOut: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>{t("status")}</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData((p) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESENT">{t("present")}</SelectItem>
                  <SelectItem value="LATE">{t("late")}</SelectItem>
                  <SelectItem value="ABSENT">{t("absent")}</SelectItem>
                  <SelectItem value="HALF_DAY">{t("halfDay")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("notes")}</Label>
              <Input value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleSubmitRecord} disabled={saving}>{saving ? tc("loading") : tc("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
