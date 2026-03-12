"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

interface SummaryRow {
  employeeId: string;
  employeeName: string;
  present: number;
  late: number;
  absent: number;
  halfDay: number;
  earlyCheckout: number;
  overtime: number;
  days: Array<any>;
}

export default function AttendancePage() {
  const t = useTranslations("attendance");
  const [month] = useState(() => new Date().getMonth() + 1);
  const [year] = useState(() => new Date().getFullYear());
  const [summary, setSummary] = useState<any>(null);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<any>(null);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [requestForm, setRequestForm] = useState({ attendanceId: "", requestedClockIn: "", requestedClockOut: "", reason: "" });
  const [schedule, setSchedule] = useState({ startTime: "08:00", endTime: "17:00", lateToleranceMinutes: 5 });

  const fetchData = useCallback(async () => {
    const [summaryRes, empRes, correctionRes] = await Promise.all([
      fetch(`/api/attendance/summary?month=${month}&year=${year}`),
      fetch("/api/employees?pageSize=500"),
      fetch("/api/attendance/corrections"),
    ]);
    const [summaryJson, empJson, correctionJson] = await Promise.all([summaryRes.json(), empRes.json(), correctionRes.json()]);
    if (summaryJson.success) setSummary(summaryJson.data);
    if (empJson.success) setEmployees(empJson.data.items ?? []);
    if (correctionJson.success) setCorrections(correctionJson.data ?? []);
  }, [month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const employeeRows: SummaryRow[] = summary?.byEmployee ?? [];

  useEffect(() => {
    if (!selectedEmployee) return;
    fetch(`/api/attendance/schedules?employeeId=${selectedEmployee}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setSchedule(json.data);
      });
  }, [selectedEmployee]);

  const reportTotals = useMemo(() => ({
    present: summary?.totalPresent ?? 0,
    late: summary?.totalLate ?? 0,
    earlyCheckout: summary?.totalEarlyCheckout ?? 0,
    overtime: summary?.totalOvertime ?? 0,
  }), [summary]);

  const saveSchedule = async () => {
    if (!selectedEmployee) return toast.error("Select employee first");
    const res = await fetch("/api/attendance/schedules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: selectedEmployee, ...schedule }),
    });
    const json = await res.json();
    if (json.success) toast.success("Schedule updated");
    else toast.error(json.error || "Failed");
  };

  const submitCorrectionRequest = async () => {
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
      toast.success("Correction request submitted");
      setRequestForm({ attendanceId: "", requestedClockIn: "", requestedClockOut: "", reason: "" });
      fetchData();
    } else toast.error(json.error || "Failed");
  };

  const reviewCorrection = async (id: string, action: "APPROVED" | "REJECTED") => {
    const res = await fetch(`/api/attendance/corrections/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success(`Correction ${action.toLowerCase()}`);
      fetchData();
    } else toast.error(json.error || "Failed");
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Tabs defaultValue="report">
        <TabsList>
          <TabsTrigger value="report">Report</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="schedule">Schedules</TabsTrigger>
          <TabsTrigger value="correction">Corrections</TabsTrigger>
        </TabsList>

        <TabsContent value="report">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardHeader><CardTitle>Present</CardTitle></CardHeader><CardContent>{reportTotals.present}</CardContent></Card>
            <Card><CardHeader><CardTitle>Late</CardTitle></CardHeader><CardContent>{reportTotals.late}</CardContent></Card>
            <Card><CardHeader><CardTitle>Early Checkout</CardTitle></CardHeader><CardContent>{reportTotals.earlyCheckout}</CardContent></Card>
            <Card><CardHeader><CardTitle>Overtime</CardTitle></CardHeader><CardContent>{reportTotals.overtime}</CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader><CardTitle>Attendance Details ({format(new Date(year, month - 1, 1), "MMMM yyyy")})</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Present</TableHead><TableHead>Late</TableHead><TableHead>Early</TableHead><TableHead>Overtime</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {employeeRows.map((r) => (
                    <TableRow key={r.employeeId}>
                      <TableCell>{r.employeeName}</TableCell>
                      <TableCell>{r.present}</TableCell>
                      <TableCell>{r.late}</TableCell>
                      <TableCell>{r.earlyCheckout}</TableCell>
                      <TableCell>{r.overtime}</TableCell>
                      <TableCell><Button size="sm" variant="outline" onClick={() => { setDetailRecord(r.days[0] || null); setDetailOpen(true); }}>View latest</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <Card>
            <CardHeader><CardTitle>Employee Schedule</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Label>Employee</Label>
              <select className="w-full border rounded h-9 px-2" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}>
                <option value="">Select</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Start</Label><Input type="time" value={schedule.startTime} onChange={(e) => setSchedule((s) => ({ ...s, startTime: e.target.value }))} /></div>
                <div><Label>End</Label><Input type="time" value={schedule.endTime} onChange={(e) => setSchedule((s) => ({ ...s, endTime: e.target.value }))} /></div>
                <div><Label>Late tolerance (min)</Label><Input type="number" value={schedule.lateToleranceMinutes} onChange={(e) => setSchedule((s) => ({ ...s, lateToleranceMinutes: Number(e.target.value) }))} /></div>
              </div>
              <Button onClick={saveSchedule}>Save schedule</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="correction">
          <Card>
            <CardHeader><CardTitle>Attendance Correction Requests</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Input placeholder="Attendance ID" value={requestForm.attendanceId} onChange={(e) => setRequestForm((p) => ({ ...p, attendanceId: e.target.value }))} />
                <Input type="datetime-local" value={requestForm.requestedClockIn} onChange={(e) => setRequestForm((p) => ({ ...p, requestedClockIn: e.target.value }))} />
                <Input type="datetime-local" value={requestForm.requestedClockOut} onChange={(e) => setRequestForm((p) => ({ ...p, requestedClockOut: e.target.value }))} />
                <Input placeholder="Reason" value={requestForm.reason} onChange={(e) => setRequestForm((p) => ({ ...p, reason: e.target.value }))} />
              </div>
              <Button onClick={submitCorrectionRequest}>Request correction</Button>
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Reason</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {corrections.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.employee?.name}</TableCell>
                      <TableCell>{c.attendance?.date ? format(new Date(c.attendance.date), "yyyy-MM-dd") : "-"}</TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                      <TableCell>{c.reason}</TableCell>
                      <TableCell className="space-x-2">
                        {c.status === "PENDING" && <>
                          <Button size="sm" onClick={() => reviewCorrection(c.id, "APPROVED")}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => reviewCorrection(c.id, "REJECTED")}>Reject</Button>
                        </>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Attendance Detail</DialogTitle></DialogHeader>
          {detailRecord ? (
            <div className="space-y-2 text-sm">
              <p>Date: {detailRecord.date}</p>
              <p>Clock In: {detailRecord.clockIn ? new Date(detailRecord.clockIn).toLocaleString() : "-"}</p>
              <p>Clock Out: {detailRecord.clockOut ? new Date(detailRecord.clockOut).toLocaleString() : "-"}</p>
              <p>GPS In: {detailRecord.checkInLatitude ?? "-"}, {detailRecord.checkInLongitude ?? "-"}</p>
              <p>GPS Out: {detailRecord.checkOutLatitude ?? "-"}, {detailRecord.checkOutLongitude ?? "-"}</p>
              {detailRecord.checkInSelfieUrl && <img src={detailRecord.checkInSelfieUrl} alt="check-in selfie" className="rounded border" />}
            </div>
          ) : <p>No detail.</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
