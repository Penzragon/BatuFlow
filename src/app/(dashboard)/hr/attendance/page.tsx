"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { UserRole } from "@prisma/client";

/** One calendar day row returned inside the monthly summary API. */
interface AttendanceDayRow {
  id: string;
  date: string;
  status: string;
  clockIn: string | null;
  clockOut: string | null;
  checkInSelfieUrl: string | null;
  checkOutSelfieUrl: string | null;
  checkInLatitude: number | null;
  checkInLongitude: number | null;
  checkOutLatitude: number | null;
  checkOutLongitude: number | null;
  isEarlyCheckout: boolean;
  isOvertime: boolean;
  lateMinutes: number;
}

interface SummaryByEmployeeRow {
  employeeId: string;
  employeeName: string;
  present: number;
  late: number;
  absent: number;
  halfDay: number;
  earlyCheckout: number;
  overtime: number;
  days: AttendanceDayRow[];
}

interface MonthlySummaryPayload {
  byEmployee: SummaryByEmployeeRow[];
  totalPresent: number;
  totalLate: number;
  totalAbsent: number;
  totalHalfDay: number;
  totalEarlyCheckout: number;
  totalOvertime: number;
}

interface CorrectionListItem {
  id: string;
  status: string;
  reason: string;
  employee?: { id: string; name: string };
  attendance?: { id: string; date: string; clockIn: string | null; clockOut: string | null };
}

interface ListAttendanceItem {
  id: string;
  date: string;
  status: string;
  clockIn: string | null;
  clockOut: string | null;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthRangeIso(year: number, month: number) {
  const dateFrom = `${year}-${pad2(month)}-01`;
  const last = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${pad2(month)}-${pad2(last)}`;
  return { dateFrom, dateTo };
}

export default function AttendancePage() {
  const t = useTranslations("attendance");
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;
  const canReviewCorrections = role === "ADMIN" || role === "MANAGER";
  const canManualEntry = role === "ADMIN" || role === "MANAGER";

  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [summary, setSummary] = useState<MonthlySummaryPayload | null>(null);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<SummaryByEmployeeRow | null>(null);
  const [corrections, setCorrections] = useState<CorrectionListItem[]>([]);
  const [hasLinkedEmployee, setHasLinkedEmployee] = useState(false);
  const [gateInfo, setGateInfo] = useState<{ employeeId: string; employeeName: string } | null>(
    null
  );
  const [correctionRecords, setCorrectionRecords] = useState<ListAttendanceItem[]>([]);
  const [loadingCorrectionRecords, setLoadingCorrectionRecords] = useState(false);
  const [requestForm, setRequestForm] = useState({
    attendanceId: "",
    requestedClockIn: "",
    requestedClockOut: "",
    reason: "",
  });
  const [schedule, setSchedule] = useState({
    startTime: "08:00",
    endTime: "17:00",
    lateToleranceMinutes: 5,
  });
  const [manualForm, setManualForm] = useState({
    employeeId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    clockIn: "",
    clockOut: "",
    status: "PRESENT" as "PRESENT" | "LATE" | "ABSENT" | "HALF_DAY",
    notes: "",
  });
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ src: string; title: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [summaryRes, empRes, correctionRes, gateRes] = await Promise.all([
        fetch(`/api/attendance/summary?month=${month}&year=${year}`),
        fetch("/api/employees?pageSize=500"),
        fetch("/api/attendance/corrections"),
        fetch("/api/attendance/gate-status", { cache: "no-store" }),
      ]);
      const [summaryJson, empJson, correctionJson, gateJson] = await Promise.all([
        summaryRes.json(),
        empRes.json(),
        correctionRes.json(),
        gateRes.json(),
      ]);
      if (cancelled) return;
      if (summaryJson.success) setSummary(summaryJson.data as MonthlySummaryPayload);
      if (empJson.success) setEmployees(empJson.data.items ?? []);
      if (correctionJson.success) setCorrections(correctionJson.data ?? []);
      if (gateJson.success && gateJson.data?.hasEmployee) {
        setHasLinkedEmployee(true);
        setGateInfo({
          employeeId: gateJson.data.employeeId as string,
          employeeName: (gateJson.data.employeeName as string) ?? "",
        });
      } else if (gateJson.success) {
        setHasLinkedEmployee(false);
        setGateInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [month, year]);

  useEffect(() => {
    if (!selectedEmployeeId) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/attendance/schedules?employeeId=${selectedEmployeeId}`);
      const json = await res.json();
      if (cancelled || !json.success) return;
      setSchedule({
        startTime: json.data.startTime ?? "08:00",
        endTime: json.data.endTime ?? "17:00",
        lateToleranceMinutes: json.data.lateToleranceMinutes ?? 5,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedEmployeeId]);

  const employeeRows: SummaryByEmployeeRow[] = summary?.byEmployee ?? [];

  const sortedDetailDays = useMemo(() => {
    if (!detailRow) return [];
    return [...detailRow.days].sort((a, b) => b.date.localeCompare(a.date));
  }, [detailRow]);

  const reportTotals = useMemo(
    () => ({
      present: summary?.totalPresent ?? 0,
      late: summary?.totalLate ?? 0,
      absent: summary?.totalAbsent ?? 0,
      halfDay: summary?.totalHalfDay ?? 0,
      earlyCheckout: summary?.totalEarlyCheckout ?? 0,
      overtime: summary?.totalOvertime ?? 0,
    }),
    [summary]
  );

  const loadCorrectionAttendanceRecords = async () => {
    const empId = gateInfo?.employeeId;
    if (!empId) {
      toast.error(t("correction.noLinkedEmployee"));
      return;
    }
    setLoadingCorrectionRecords(true);
    try {
      const { dateFrom, dateTo } = monthRangeIso(year, month);
      const res = await fetch(
        `/api/attendance?employeeId=${empId}&dateFrom=${dateFrom}&dateTo=${dateTo}&pageSize=100`
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed");
      setCorrectionRecords(json.data.items ?? []);
      if ((json.data.items ?? []).length === 0) toast.message(t("details.noDays"));
    } catch {
      toast.error(t("correction.failed"));
    } finally {
      setLoadingCorrectionRecords(false);
    }
  };

  const saveSchedule = async () => {
    if (!selectedEmployeeId) {
      toast.error(t("schedule.selectFirst"));
      return;
    }
    const res = await fetch("/api/attendance/schedules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: selectedEmployeeId, ...schedule }),
    });
    const json = await res.json();
    if (json.success) toast.success(t("schedule.updated"));
    else toast.error(json.error || t("schedule.failed"));
  };

  const submitCorrectionRequest = async () => {
    if (!requestForm.attendanceId) {
      toast.error(t("correction.needRecord"));
      return;
    }
    if (!hasLinkedEmployee) {
      toast.error(t("correction.noLinkedEmployee"));
      return;
    }
    const res = await fetch("/api/attendance/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attendanceId: requestForm.attendanceId,
        requestedClockIn: requestForm.requestedClockIn ? new Date(requestForm.requestedClockIn).toISOString() : null,
        requestedClockOut: requestForm.requestedClockOut ? new Date(requestForm.requestedClockOut).toISOString() : null,
        reason: requestForm.reason,
      }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success(t("correction.submitted"));
      setRequestForm({
        attendanceId: "",
        requestedClockIn: "",
        requestedClockOut: "",
        reason: "",
      });
      const correctionRes = await fetch("/api/attendance/corrections");
      const correctionJson = await correctionRes.json();
      if (correctionJson.success) setCorrections(correctionJson.data ?? []);
    } else toast.error(json.error || t("correction.failed"));
  };

  const reviewCorrection = async (id: string, action: "APPROVED" | "REJECTED") => {
    const res = await fetch(`/api/attendance/corrections/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success(t("correction.reviewed"));
      const correctionRes = await fetch("/api/attendance/corrections");
      const correctionJson = await correctionRes.json();
      if (correctionJson.success) setCorrections(correctionJson.data ?? []);
    } else toast.error(json.error || t("correction.failed"));
  };

  const submitManualAttendance = async () => {
    if (!manualForm.employeeId) {
      toast.error(t("schedule.selectFirst"));
      return;
    }
    setManualSubmitting(true);
    try {
      const body = {
        employeeId: manualForm.employeeId,
        date: manualForm.date,
        clockIn: manualForm.clockIn ? new Date(manualForm.clockIn).toISOString() : null,
        clockOut: manualForm.clockOut ? new Date(manualForm.clockOut).toISOString() : null,
        status: manualForm.status,
        notes: manualForm.notes.trim() || null,
      };
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || t("manual.failed"));
      toast.success(t("manual.saved"));
      const summaryRes = await fetch(`/api/attendance/summary?month=${month}&year=${year}`);
      const summaryJson = await summaryRes.json();
      if (summaryJson.success) setSummary(summaryJson.data as MonthlySummaryPayload);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("manual.failed"));
    } finally {
      setManualSubmitting(false);
    }
  };

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>{t("month")}</Label>
          <select
            className="mt-1 flex h-9 w-36 rounded-md border bg-background px-2 text-sm"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {format(new Date(year, m - 1, 1), "MMMM")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>{t("year")}</Label>
          <select
            className="mt-1 flex h-9 w-28 rounded-md border bg-background px-2 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Tabs defaultValue="report">
        <TabsList>
          <TabsTrigger value="report">{t("tabs.report")}</TabsTrigger>
          <TabsTrigger value="details">{t("tabs.details")}</TabsTrigger>
          <TabsTrigger value="schedule">{t("tabs.schedule")}</TabsTrigger>
          <TabsTrigger value="correction">{t("tabs.correction")}</TabsTrigger>
          {canManualEntry && <TabsTrigger value="manual">{t("tabs.manual")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="report" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t("present")}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{reportTotals.present}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t("late")}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{reportTotals.late}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t("absent")}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{reportTotals.absent}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t("halfDay")}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{reportTotals.halfDay}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t("report.earlyCheckout")}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{reportTotals.earlyCheckout}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t("report.overtime")}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{reportTotals.overtime}</CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>
                {t("details.title")} ({format(new Date(year, month - 1, 1), "MMMM yyyy")})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("employee")}</TableHead>
                    <TableHead>{t("present")}</TableHead>
                    <TableHead>{t("late")}</TableHead>
                    <TableHead>{t("details.absent")}</TableHead>
                    <TableHead>{t("details.halfDay")}</TableHead>
                    <TableHead>{t("report.earlyCheckout")}</TableHead>
                    <TableHead>{t("report.overtime")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeRows.map((r) => (
                    <TableRow key={r.employeeId}>
                      <TableCell>{r.employeeName}</TableCell>
                      <TableCell>{r.present}</TableCell>
                      <TableCell>{r.late}</TableCell>
                      <TableCell>{r.absent}</TableCell>
                      <TableCell>{r.halfDay}</TableCell>
                      <TableCell>{r.earlyCheckout}</TableCell>
                      <TableCell>{r.overtime}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={r.days.length === 0}
                          onClick={() => {
                            setDetailRow(r);
                            setDetailOpen(true);
                          }}
                        >
                          {t("details.viewDays")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle>{t("schedule.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label>{t("employee")}</Label>
              <select
                className="flex h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
              >
                <option value="">{t("schedule.selectEmployee")}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <div>
                  <Label>{t("schedule.start")}</Label>
                  <Input
                    type="time"
                    value={schedule.startTime}
                    onChange={(e) => setSchedule((s) => ({ ...s, startTime: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t("schedule.end")}</Label>
                  <Input
                    type="time"
                    value={schedule.endTime}
                    onChange={(e) => setSchedule((s) => ({ ...s, endTime: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t("schedule.lateTolerance")}</Label>
                  <Input
                    type="number"
                    value={schedule.lateToleranceMinutes}
                    onChange={(e) =>
                      setSchedule((s) => ({ ...s, lateToleranceMinutes: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>
              <Button type="button" onClick={() => void saveSchedule()}>
                {t("schedule.save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="correction">
          <Card>
            <CardHeader>
              <CardTitle>{t("correction.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasLinkedEmployee ? (
                <div className="space-y-3 rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">
                    {t("correction.requestHint", { name: gateInfo?.employeeName ?? "" })}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingCorrectionRecords}
                    onClick={() => void loadCorrectionAttendanceRecords()}
                  >
                    {t("correction.loadRecords")}
                  </Button>
                  <div>
                    <Label>{t("correction.selectRecord")}</Label>
                    <select
                      className="mt-1 flex h-9 w-full rounded-md border bg-background px-2 text-sm"
                      value={requestForm.attendanceId}
                      onChange={(e) => setRequestForm((p) => ({ ...p, attendanceId: e.target.value }))}
                    >
                      <option value="">{t("correction.pickRecord")}</option>
                      {correctionRecords.map((rec) => (
                        <option key={rec.id} value={rec.id}>
                          {rec.date} · {rec.status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div>
                      <Label>{t("clockIn")} (optional)</Label>
                      <Input
                        type="datetime-local"
                        value={requestForm.requestedClockIn}
                        onChange={(e) => setRequestForm((p) => ({ ...p, requestedClockIn: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>{t("clockOut")} (optional)</Label>
                      <Input
                        type="datetime-local"
                        value={requestForm.requestedClockOut}
                        onChange={(e) => setRequestForm((p) => ({ ...p, requestedClockOut: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>{t("notes")}</Label>
                    <Textarea
                      value={requestForm.reason}
                      onChange={(e) => setRequestForm((p) => ({ ...p, reason: e.target.value }))}
                      className="min-h-[80px]"
                    />
                  </div>
                  <Button type="button" onClick={() => void submitCorrectionRequest()}>
                    {t("correction.request")}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("correction.noLinkedEmployee")}</p>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("employee")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("notes")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {corrections.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.employee?.name}</TableCell>
                      <TableCell>
                        {c.attendance?.date ? format(new Date(c.attendance.date), "yyyy-MM-dd") : "-"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell>{c.reason}</TableCell>
                      <TableCell className="space-x-2">
                        {c.status === "PENDING" && canReviewCorrections && (
                          <>
                            <Button size="sm" type="button" onClick={() => void reviewCorrection(c.id, "APPROVED")}>
                              {t("correction.approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              type="button"
                              onClick={() => void reviewCorrection(c.id, "REJECTED")}
                            >
                              {t("correction.reject")}
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {canManualEntry && (
          <TabsContent value="manual">
            <Card>
              <CardHeader>
                <CardTitle>{t("manual.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{t("manual.hint")}</p>
                <div>
                  <Label>{t("employee")}</Label>
                  <select
                    className="mt-1 flex h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={manualForm.employeeId}
                    onChange={(e) => setManualForm((f) => ({ ...f, employeeId: e.target.value }))}
                  >
                    <option value="">{t("schedule.selectEmployee")}</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t("date")}</Label>
                  <Input
                    type="date"
                    value={manualForm.date}
                    onChange={(e) => setManualForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div>
                    <Label>{t("clockIn")}</Label>
                    <Input
                      type="datetime-local"
                      value={manualForm.clockIn}
                      onChange={(e) => setManualForm((f) => ({ ...f, clockIn: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>{t("clockOut")}</Label>
                    <Input
                      type="datetime-local"
                      value={manualForm.clockOut}
                      onChange={(e) => setManualForm((f) => ({ ...f, clockOut: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>{t("status")}</Label>
                  <select
                    className="mt-1 flex h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={manualForm.status}
                    onChange={(e) =>
                      setManualForm((f) => ({
                        ...f,
                        status: e.target.value as typeof manualForm.status,
                      }))
                    }
                  >
                    <option value="PRESENT">{t("present")}</option>
                    <option value="LATE">{t("late")}</option>
                    <option value="ABSENT">{t("absent")}</option>
                    <option value="HALF_DAY">{t("halfDay")}</option>
                  </select>
                </div>
                <div>
                  <Label>{t("notes")}</Label>
                  <Textarea
                    value={manualForm.notes}
                    onChange={(e) => setManualForm((f) => ({ ...f, notes: e.target.value }))}
                    className="min-h-[80px]"
                  />
                </div>
                <Button type="button" disabled={manualSubmitting} onClick={() => void submitManualAttendance()}>
                  {manualSubmitting ? "…" : t("manual.submit")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detailRow?.employeeName} — {t("details.dayListTitle")}
            </DialogTitle>
          </DialogHeader>
          {sortedDetailDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("details.noDays")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("clockIn")}</TableHead>
                  <TableHead>{t("clockOut")}</TableHead>
                  <TableHead>{t("details.lateMin")}</TableHead>
                  <TableHead>Selfie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDetailDays.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.date}</TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {d.clockIn ? format(new Date(d.clockIn), "yyyy-MM-dd HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {d.clockOut ? format(new Date(d.clockOut), "yyyy-MM-dd HH:mm") : "—"}
                    </TableCell>
                    <TableCell>{d.lateMinutes > 0 ? d.lateMinutes : "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {d.checkInSelfieUrl ? (
                          <button
                            type="button"
                            className="rounded border"
                            onClick={() =>
                              setPhotoPreview({
                                src: d.checkInSelfieUrl as string,
                                title: `${t("clockIn")} Selfie`,
                              })
                            }
                            aria-label={`${t("clockIn")} selfie`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- attendance selfies are data URLs */}
                            <img
                              src={d.checkInSelfieUrl}
                              alt={`${t("clockIn")} selfie`}
                              className="h-10 w-10 rounded object-cover"
                            />
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {d.checkOutSelfieUrl ? (
                          <button
                            type="button"
                            className="rounded border"
                            onClick={() =>
                              setPhotoPreview({
                                src: d.checkOutSelfieUrl as string,
                                title: `${t("clockOut")} Selfie`,
                              })
                            }
                            aria-label={`${t("clockOut")} selfie`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- attendance selfies are data URLs */}
                            <img
                              src={d.checkOutSelfieUrl}
                              alt={`${t("clockOut")} selfie`}
                              className="h-10 w-10 rounded object-cover"
                            />
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(photoPreview)} onOpenChange={(open) => !open && setPhotoPreview(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{photoPreview?.title ?? "Selfie"}</DialogTitle>
          </DialogHeader>
          {photoPreview?.src ? (
            <div className="overflow-hidden rounded-md border bg-black/70">
              {/* eslint-disable-next-line @next/next/no-img-element -- attendance selfies are data URLs */}
              <img src={photoPreview.src} alt={photoPreview.title} className="max-h-[70vh] w-full object-contain" />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
