"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Calendar, FileText, ClipboardList, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface EmployeeDetail {
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
  phone: string | null;
  email: string | null;
  address: string | null;
  bankAccount: string | null;
  bankName: string | null;
  status: string;
  user?: { id: string; name: string; email: string } | null;
}

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("employees");
  const tAtt = useTranslations("attendance");
  const tLeave = useTranslations("leave");
  const tPay = useTranslations("payroll");

  const id = params.id as string;
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<Array<{ date: string; status: string; clockIn?: string; clockOut?: string }>>([]);
  const [leaveRequests, setLeaveRequests] = useState<Array<{ id: string; leaveType: string; startDate: string; endDate: string; days: number; status: string }>>([]);
  const [payrollLines, setPayrollLines] = useState<Array<{ id: string; periodMonth: number; periodYear: number; netPay: number }>>([]);

  const fetchEmployee = useCallback(async () => {
    try {
      const res = await fetch(`/api/employees/${id}`);
      const json = await res.json();
      if (json.success) setEmployee(json.data);
      else toast.error("Employee not found");
    } catch {
      toast.error("Failed to load employee");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  const fetchAttendance = useCallback(async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const res = await fetch(`/api/attendance/summary?month=${now.getMonth() + 1}&year=${now.getFullYear()}&employeeId=${id}`);
    const json = await res.json();
    if (json.success && json.data?.byEmployee?.length) {
      const empData = json.data.byEmployee.find((e: { employeeId: string }) => e.employeeId === id);
      setAttendance(empData?.days ?? []);
    } else {
      setAttendance([]);
    }
  }, [id]);

  const fetchLeave = useCallback(async () => {
    const res = await fetch(`/api/leave-requests?employeeId=${id}&pageSize=50`);
    const json = await res.json();
    if (json.success) setLeaveRequests(json.data?.items ?? []);
    else setLeaveRequests([]);
  }, [id]);

  const fetchPayroll = useCallback(async () => {
    const res = await fetch(`/api/payroll?pageSize=24`);
    const json = await res.json();
    if (!json.success || !json.data?.items?.length) {
      setPayrollLines([]);
      return;
    }
    const runs = json.data.items as Array<{ id: string; periodMonth: number; periodYear: number }>;
    const lines: Array<{ id: string; periodMonth: number; periodYear: number; netPay: number }> = [];
    for (const run of runs.slice(0, 12)) {
      try {
        const r = await fetch(`/api/payroll/${run.id}`);
        const j = await r.json();
        if (j.success && j.data?.lines) {
          const line = (j.data.lines as Array<{ employeeId: string; netPay: number }>).find((l) => l.employeeId === id);
          if (line) lines.push({ id: run.id, periodMonth: run.periodMonth, periodYear: run.periodYear, netPay: line.netPay });
        }
      } catch {
        // skip
      }
    }
    setPayrollLines(lines);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchAttendance();
    fetchLeave();
    fetchPayroll();
  }, [id, fetchAttendance, fetchLeave, fetchPayroll]);

  if (loading || !employee) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={employee.name}
        description={employee.department ?? undefined}
        actions={
          <Button variant="outline" onClick={() => router.push("/hr/employees")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">{t("info")}</TabsTrigger>
          <TabsTrigger value="attendance">{t("attendanceTab")}</TabsTrigger>
          <TabsTrigger value="leave">{t("leaveTab")}</TabsTrigger>
          <TabsTrigger value="payroll">{t("payrollHistoryTab")}</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("employeeDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div><span className="text-muted-foreground">{t("name")}:</span> {employee.name}</div>
              <div><span className="text-muted-foreground">{t("nik")}:</span> {employee.nik ?? "—"}</div>
              <div><span className="text-muted-foreground">{t("department")}:</span> {employee.department ?? "—"}</div>
              <div><span className="text-muted-foreground">{t("position")}:</span> {employee.position ?? "—"}</div>
              <div><span className="text-muted-foreground">{t("joinDate")}:</span> {employee.joinDate ? format(new Date(employee.joinDate), "PP") : "—"}</div>
              <div><span className="text-muted-foreground">{t("status")}:</span> <StatusBadge status={employee.status} /></div>
              <div><span className="text-muted-foreground">{t("basicSalary")}:</span> {formatIDR(employee.basicSalary)}</div>
              <div><span className="text-muted-foreground">{t("allowances")}:</span> {formatIDR(employee.allowances)}</div>
              <div><span className="text-muted-foreground">{t("deductions")}:</span> {formatIDR(employee.deductions)}</div>
              <div><span className="text-muted-foreground">{t("employmentType")}:</span> {employee.employmentType === "PERMANENT" ? t("permanent") : t("contract")}</div>
              <div><span className="text-muted-foreground">{t("email")}:</span> {employee.email ?? employee.user?.email ?? "—"}</div>
              <div><span className="text-muted-foreground">{t("phone")}:</span> {employee.phone ?? "—"}</div>
              <div className="sm:col-span-2"><span className="text-muted-foreground">{t("address")}:</span> {employee.address ?? "—"}</div>
              <div><span className="text-muted-foreground">{t("bankName")}:</span> {employee.bankName ?? "—"}</div>
              <div><span className="text-muted-foreground">{t("bankAccount")}:</span> {employee.bankAccount ?? "—"}</div>
              {employee.user && (
                <div className="sm:col-span-2"><span className="text-muted-foreground">{t("linkedUser")}:</span> {employee.user.name} ({employee.user.email})</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{tAtt("monthlySummary")}</CardTitle>
              <p className="text-sm text-muted-foreground">{format(new Date(), "MMMM yyyy")}</p>
            </CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <p className="text-muted-foreground">{tAtt("noRecords")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tAtt("date")}</TableHead>
                      <TableHead>{tAtt("status")}</TableHead>
                      <TableHead>{tAtt("clockIn")}</TableHead>
                      <TableHead>{tAtt("clockOut")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((d) => (
                      <TableRow key={d.date}>
                        <TableCell>{d.date}</TableCell>
                        <TableCell><StatusBadge status={d.status} /></TableCell>
                        <TableCell>{d.clockIn ? format(new Date(d.clockIn), "HH:mm") : "—"}</TableCell>
                        <TableCell>{d.clockOut ? format(new Date(d.clockOut), "HH:mm") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="leave" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{tLeave("title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {leaveRequests.length === 0 ? (
                <p className="text-muted-foreground">{tLeave("noRequests")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tLeave("leaveType")}</TableHead>
                      <TableHead>{tLeave("startDate")}</TableHead>
                      <TableHead>{tLeave("endDate")}</TableHead>
                      <TableHead>{tLeave("days")}</TableHead>
                      <TableHead>{tLeave("status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.map((lr) => (
                      <TableRow key={lr.id}>
                        <TableCell>{lr.leaveType}</TableCell>
                        <TableCell>{lr.startDate}</TableCell>
                        <TableCell>{lr.endDate}</TableCell>
                        <TableCell>{lr.days}</TableCell>
                        <TableCell><StatusBadge status={lr.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="payroll" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("payrollHistoryTab")}</CardTitle>
            </CardHeader>
            <CardContent>
              {payrollLines.length === 0 ? (
                <p className="text-muted-foreground">{tPay("noRuns")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tPay("period")}</TableHead>
                      <TableHead className="text-right">{tPay("netPay")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollLines.map((pl) => (
                      <TableRow key={pl.id}>
                        <TableCell>{pl.periodYear}-{String(pl.periodMonth).padStart(2, "0")}</TableCell>
                        <TableCell className="text-right">{formatIDR(pl.netPay)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
