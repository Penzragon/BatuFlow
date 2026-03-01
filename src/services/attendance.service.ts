import { z } from "zod";
import { prisma } from "@/lib/db";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { Attendance } from "@prisma/client";

export const recordAttendanceSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string(),
  clockIn: z.string().optional().nullable(),
  clockOut: z.string().optional().nullable(),
  status: z.enum(["PRESENT", "LATE", "ABSENT", "HALF_DAY"]).default("PRESENT"),
  notes: z.string().max(500).optional().nullable(),
});

interface AttendanceListParams extends PaginationParams {
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
}

const LATE_THRESHOLD_HOUR = 9; // 09:00 considered on-time
const LATE_THRESHOLD_MINUTE = 0;

export class AttendanceService {
  static async clockIn(employeeId: string, clockInTime?: Date): Promise<Attendance> {
    const now = clockInTime ?? new Date();
    const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_date: { employeeId, date: dateOnly },
      },
    });

    const isLate =
      now.getHours() > LATE_THRESHOLD_HOUR ||
      (now.getHours() === LATE_THRESHOLD_HOUR && now.getMinutes() > LATE_THRESHOLD_MINUTE);
    const status = isLate ? "LATE" : "PRESENT";

    if (existing) {
      return prisma.attendance.update({
        where: { id: existing.id },
        data: { clockIn: now, status },
      });
    }

    return prisma.attendance.create({
      data: {
        employeeId,
        date: dateOnly,
        clockIn: now,
        status,
      },
    });
  }

  static async clockOut(employeeId: string, clockOutTime?: Date): Promise<Attendance> {
    const now = clockOutTime ?? new Date();
    const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_date: { employeeId, date: dateOnly },
      },
    });
    if (!existing) throw new Error("No clock-in record found for today");

    return prisma.attendance.update({
      where: { id: existing.id },
      data: { clockOut: now },
    });
  }

  static async recordAttendance(
    data: z.infer<typeof recordAttendanceSchema>
  ): Promise<Attendance> {
    const parsed = recordAttendanceSchema.parse(data);
    const date = new Date(parsed.date);
    date.setHours(0, 0, 0, 0);

    const clockIn = parsed.clockIn ? new Date(parsed.clockIn) : null;
    const clockOut = parsed.clockOut ? new Date(parsed.clockOut) : null;

    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_date: { employeeId: parsed.employeeId, date },
      },
    });

    const payload = {
      date,
      clockIn,
      clockOut,
      status: parsed.status,
      notes: parsed.notes ?? null,
    };

    if (existing) {
      return prisma.attendance.update({
        where: { id: existing.id },
        data: payload,
      });
    }

    return prisma.attendance.create({
      data: {
        employeeId: parsed.employeeId,
        ...payload,
      },
    });
  }

  static async getAttendanceByEmployee(
    employeeId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<Attendance[]> {
    const where: { employeeId: string; date?: { gte?: Date; lte?: Date } } = {
      employeeId,
    };
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.date.lte = to;
      }
    }

    return prisma.attendance.findMany({
      where,
      orderBy: { date: "desc" },
    });
  }

  static async getMonthlyAttendanceSummary(
    month: number,
    year: number,
    employeeId?: string
  ): Promise<{
    byEmployee: Array<{
      employeeId: string;
      employeeName: string;
      present: number;
      late: number;
      absent: number;
      halfDay: number;
      days: Array<{ date: string; status: string; clockIn?: string; clockOut?: string }>;
    }>;
    totalPresent: number;
    totalLate: number;
    totalAbsent: number;
    totalHalfDay: number;
  }> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    end.setHours(23, 59, 59, 999);

    const employees = await prisma.employee.findMany({
      where: { deletedAt: null, status: "ACTIVE", ...(employeeId && { id: employeeId }) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    const attendance = await prisma.attendance.findMany({
      where: {
        date: { gte: start, lte: end },
        employeeId: employeeId ?? { in: employees.map((e) => e.id) },
      },
      orderBy: [{ employeeId: "asc" }, { date: "asc" }],
    });

    const byEmployee = employees.map((emp) => {
      const records = attendance.filter((a) => a.employeeId === emp.id);
      const present = records.filter((r) => r.status === "PRESENT").length;
      const late = records.filter((r) => r.status === "LATE").length;
      const absent = records.filter((r) => r.status === "ABSENT").length;
      const halfDay = records.filter((r) => r.status === "HALF_DAY").length;
      const days = records.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        status: r.status,
        clockIn: r.clockIn?.toISOString(),
        clockOut: r.clockOut?.toISOString(),
      }));
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        present,
        late,
        absent,
        halfDay,
        days,
      };
    });

    return {
      byEmployee,
      totalPresent: byEmployee.reduce((s, e) => s + e.present, 0),
      totalLate: byEmployee.reduce((s, e) => s + e.late, 0),
      totalAbsent: byEmployee.reduce((s, e) => s + e.absent, 0),
      totalHalfDay: byEmployee.reduce((s, e) => s + e.halfDay, 0),
    };
  }

  static async listAttendance(
    params: AttendanceListParams
  ): Promise<PaginatedResponse<Attendance & { employee?: { name: string } }>> {
    const { page, pageSize, employeeId, dateFrom, dateTo } = params;

    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) (where.date as { gte?: Date }).gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        (where.date as { lte?: Date }).lte = to;
      }
    }

    const [items, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: { employee: { select: { name: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ date: "desc" }, { employeeId: "asc" }],
      }),
      prisma.attendance.count({ where }),
    ]);

    return {
      items: items as (Attendance & { employee?: { name: string } })[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
