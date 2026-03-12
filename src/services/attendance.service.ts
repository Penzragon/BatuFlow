import { z } from "zod";
import { prisma } from "@/lib/db";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type {
  Attendance,
  AttendanceCorrectionRequest,
  AttendanceCorrectionStatus,
  AttendanceStatus,
  UserRole,
} from "@prisma/client";

const DEFAULT_SCHEDULE = {
  startTime: "08:00",
  endTime: "17:00",
  lateToleranceMinutes: 5,
};

const hhmmRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const parseHhMm = (value: string) => {
  const m = value.match(hhmmRegex);
  if (!m) throw new Error("Invalid time format, expected HH:mm");
  return { hour: Number(m[1]), minute: Number(m[2]) };
};

const atLocalDateWithTime = (date: Date, hhmm: string) => {
  const { hour, minute } = parseHhMm(hhmm);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
};

const normalizeDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const recordAttendanceSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string(),
  clockIn: z.string().optional().nullable(),
  clockOut: z.string().optional().nullable(),
  status: z.enum(["PRESENT", "LATE", "ABSENT", "HALF_DAY"]).default("PRESENT"),
  notes: z.string().max(500).optional().nullable(),
});

export const setScheduleSchema = z.object({
  employeeId: z.string().uuid(),
  startTime: z.string().regex(hhmmRegex),
  endTime: z.string().regex(hhmmRegex),
  lateToleranceMinutes: z.number().int().min(0).max(60).default(5),
});

export const createCorrectionSchema = z.object({
  attendanceId: z.string().uuid(),
  requestedClockIn: z.string().datetime().optional().nullable(),
  requestedClockOut: z.string().datetime().optional().nullable(),
  reason: z.string().min(3).max(500),
});

interface AttendanceListParams extends PaginationParams {
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface ClockPayload {
  employeeId: string;
  at?: Date;
  latitude: number;
  longitude: number;
  accuracy?: number;
  selfieBuffer: Buffer;
}

function isMissingColumnError(err: unknown, column: string): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes(column) && message.includes("does not exist");
}

export class AttendanceService {
  static async getSchedule(employeeId: string) {
    try {
      const schedule = await prisma.employeeAttendanceSchedule.findUnique({ where: { employeeId } });
      return schedule ?? DEFAULT_SCHEDULE;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("employee_attendance_schedules") && message.includes("does not exist")) {
        console.warn("[AttendanceService] employee_attendance_schedules missing; fallback to default schedule");
        return DEFAULT_SCHEDULE;
      }
      throw err;
    }
  }

  static async setSchedule(input: z.infer<typeof setScheduleSchema>) {
    const data = setScheduleSchema.parse(input);
    return prisma.employeeAttendanceSchedule.upsert({
      where: { employeeId: data.employeeId },
      create: data,
      update: {
        startTime: data.startTime,
        endTime: data.endTime,
        lateToleranceMinutes: data.lateToleranceMinutes,
      },
    });
  }

  static async processSelfie(buffer: Buffer): Promise<string> {
    const sharp = (await import("sharp")).default;
    let quality = 80;
    let processedBuffer = await sharp(buffer)
      .resize(800, 600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();

    while (processedBuffer.length > 1024 * 1024 && quality > 50) {
      quality -= 10;
      processedBuffer = await sharp(processedBuffer).jpeg({ quality }).toBuffer();
    }

    return `data:image/jpeg;base64,${processedBuffer.toString("base64")}`;
  }

  static async clockIn(payload: ClockPayload): Promise<Attendance> {
    const now = payload.at ?? new Date();
    const date = normalizeDateOnly(now);
    const schedule = await this.getSchedule(payload.employeeId);
    const shiftStart = atLocalDateWithTime(date, schedule.startTime);
    const lateThreshold = new Date(shiftStart.getTime() + schedule.lateToleranceMinutes * 60_000);

    const lateMinutes = now > lateThreshold ? Math.ceil((now.getTime() - lateThreshold.getTime()) / 60_000) : 0;
    const status: AttendanceStatus = lateMinutes > 0 ? "LATE" : "PRESENT";
    const selfieUrl = await this.processSelfie(payload.selfieBuffer);

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: payload.employeeId, date } },
      select: { id: true },
    });

    const data = {
      clockIn: now,
      status,
      lateMinutes,
      checkInSelfieUrl: selfieUrl,
      checkInLatitude: payload.latitude,
      checkInLongitude: payload.longitude,
      checkInAccuracy: payload.accuracy ?? null,
      scheduleStart: schedule.startTime,
      scheduleEnd: schedule.endTime,
    };

    if (existing) {
      try {
        return await prisma.attendance.update({ where: { id: existing.id }, data });
      } catch (err) {
        if (!isMissingColumnError(err, "late_minutes")) throw err;
        console.warn("[AttendanceService] attendance new columns missing; fallback update payload");
        await prisma.$executeRaw`
          update attendance
          set clock_in = ${now}, status = ${status}::attendance_status, notes = ${null}, updated_at = now()
          where id = ${existing.id}
        `;
        const updated = await prisma.attendance.findUnique({
          where: { id: existing.id },
          select: {
            id: true,
            employeeId: true,
            date: true,
            clockIn: true,
            clockOut: true,
            status: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        if (!updated) throw new Error("Failed to update attendance fallback record");
        return updated as unknown as Attendance;
      }
    }

    try {
      return await prisma.attendance.create({
        data: {
          employeeId: payload.employeeId,
          date,
          ...data,
        },
      });
    } catch (err) {
      if (!isMissingColumnError(err, "late_minutes")) throw err;
      console.warn("[AttendanceService] attendance new columns missing; fallback create payload");
      await prisma.$executeRaw`
        insert into attendance (employee_id, date, clock_in, status, notes, created_at, updated_at)
        values (${payload.employeeId}, ${date}, ${now}, ${status}::attendance_status, ${null}, now(), now())
      `;
      const created = await prisma.attendance.findFirst({
        where: { employeeId: payload.employeeId, date },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          employeeId: true,
          date: true,
          clockIn: true,
          clockOut: true,
          status: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!created) throw new Error("Failed to create attendance fallback record");
      return created as unknown as Attendance;
    }
  }

  static async clockOut(payload: ClockPayload): Promise<Attendance> {
    const now = payload.at ?? new Date();
    const date = normalizeDateOnly(now);

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: payload.employeeId, date } },
      select: { id: true, clockIn: true },
    });
    if (!existing || !existing.clockIn) throw new Error("No clock-in record found for today");

    const schedule = await this.getSchedule(payload.employeeId);
    const shiftEnd = atLocalDateWithTime(date, schedule.endTime || DEFAULT_SCHEDULE.endTime);
    const isEarlyCheckout = now < shiftEnd;
    const isOvertime = now > shiftEnd;
    const selfieUrl = await this.processSelfie(payload.selfieBuffer);

    try {
      return await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          clockOut: now,
          isEarlyCheckout,
          isOvertime,
          checkOutSelfieUrl: selfieUrl,
          checkOutLatitude: payload.latitude,
          checkOutLongitude: payload.longitude,
          checkOutAccuracy: payload.accuracy ?? null,
        },
      });
    } catch (err) {
      if (!isMissingColumnError(err, "is_early_checkout") && !isMissingColumnError(err, "check_out_selfie_url")) {
        throw err;
      }
      console.warn("[AttendanceService] attendance checkout new columns missing; fallback update payload");
      await prisma.$executeRaw`
        update attendance
        set clock_out = ${now}, updated_at = now()
        where id = ${existing.id}
      `;
      const updated = await prisma.attendance.findUnique({
        where: { id: existing.id },
        select: {
          id: true,
          employeeId: true,
          date: true,
          clockIn: true,
          clockOut: true,
          status: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!updated) throw new Error("Failed to update attendance fallback record");
      return updated as unknown as Attendance;
    }
  }

  static async getTodayStatusByUser(userId: string) {
    const employee = await prisma.employee.findFirst({
      where: { userId, deletedAt: null, status: "ACTIVE" },
      select: { id: true, name: true },
    });

    if (!employee) return { hasEmployee: false, checkedIn: false, checkedOut: false };

    const date = normalizeDateOnly(new Date());
    const attendance = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date } },
      select: { id: true, clockIn: true, clockOut: true },
    });

    return {
      hasEmployee: true,
      employeeId: employee.id,
      employeeName: employee.name,
      checkedIn: Boolean(attendance?.clockIn),
      checkedOut: Boolean(attendance?.clockOut),
      attendance,
    };
  }

  static async requestCorrection(
    employeeId: string,
    payload: z.infer<typeof createCorrectionSchema>
  ): Promise<AttendanceCorrectionRequest> {
    const data = createCorrectionSchema.parse(payload);

    const attendance = await prisma.attendance.findFirst({
      where: { id: data.attendanceId, employeeId },
      select: { id: true },
    });
    if (!attendance) throw new Error("Attendance record not found");

    return prisma.attendanceCorrectionRequest.create({
      data: {
        attendanceId: data.attendanceId,
        employeeId,
        requestedClockIn: data.requestedClockIn ? new Date(data.requestedClockIn) : null,
        requestedClockOut: data.requestedClockOut ? new Date(data.requestedClockOut) : null,
        reason: data.reason,
      },
    });
  }

  static async reviewCorrection(
    id: string,
    reviewerUserId: string,
    action: "APPROVED" | "REJECTED",
    rejectionReason?: string
  ) {
    const req = await prisma.attendanceCorrectionRequest.findUnique({
      where: { id },
      include: { attendance: true },
    });
    if (!req) throw new Error("Correction request not found");
    if (req.status !== "PENDING") throw new Error("Request already reviewed");

    const status: AttendanceCorrectionStatus = action;

    const result = await prisma.$transaction(async (tx) => {
      const reviewed = await tx.attendanceCorrectionRequest.update({
        where: { id },
        data: {
          status,
          reviewedBy: reviewerUserId,
          reviewedAt: new Date(),
          rejectionReason: action === "REJECTED" ? rejectionReason ?? null : null,
        },
      });

      if (action === "APPROVED") {
        const data: Record<string, unknown> = {};
        if (req.requestedClockIn) data.clockIn = req.requestedClockIn;
        if (req.requestedClockOut) data.clockOut = req.requestedClockOut;
        await tx.attendance.update({ where: { id: req.attendanceId }, data });
      }

      return reviewed;
    });

    return result;
  }

  static async listCorrectionRequests(viewer: { role: UserRole; employeeId?: string }) {
    return prisma.attendanceCorrectionRequest.findMany({
      where: viewer.role === "STAFF" ? { employeeId: viewer.employeeId } : undefined,
      include: {
        employee: { select: { id: true, name: true } },
        attendance: { select: { id: true, date: true, clockIn: true, clockOut: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async recordAttendance(data: z.infer<typeof recordAttendanceSchema>): Promise<Attendance> {
    const parsed = recordAttendanceSchema.parse(data);
    const date = normalizeDateOnly(new Date(parsed.date));

    const clockIn = parsed.clockIn ? new Date(parsed.clockIn) : null;
    const clockOut = parsed.clockOut ? new Date(parsed.clockOut) : null;

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: parsed.employeeId, date } },
    });

    const payload = {
      date,
      clockIn,
      clockOut,
      status: parsed.status,
      notes: parsed.notes ?? null,
    };

    if (existing) {
      return prisma.attendance.update({ where: { id: existing.id }, data: payload });
    }

    return prisma.attendance.create({ data: { employeeId: parsed.employeeId, ...payload } });
  }

  static async getMonthlyAttendanceSummary(month: number, year: number, employeeId?: string) {
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
      const earlyCheckout = records.filter((r) => r.isEarlyCheckout).length;
      const overtime = records.filter((r) => r.isOvertime).length;

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        present,
        late,
        absent,
        halfDay,
        earlyCheckout,
        overtime,
        days: records.map((r) => ({
          id: r.id,
          date: r.date.toISOString().slice(0, 10),
          status: r.status,
          clockIn: r.clockIn?.toISOString(),
          clockOut: r.clockOut?.toISOString(),
          checkInSelfieUrl: r.checkInSelfieUrl,
          checkOutSelfieUrl: r.checkOutSelfieUrl,
          checkInLatitude: r.checkInLatitude,
          checkInLongitude: r.checkInLongitude,
          checkOutLatitude: r.checkOutLatitude,
          checkOutLongitude: r.checkOutLongitude,
          isEarlyCheckout: r.isEarlyCheckout,
          isOvertime: r.isOvertime,
          lateMinutes: r.lateMinutes,
        })),
      };
    });

    return {
      byEmployee,
      totalPresent: byEmployee.reduce((s, e) => s + e.present, 0),
      totalLate: byEmployee.reduce((s, e) => s + e.late, 0),
      totalAbsent: byEmployee.reduce((s, e) => s + e.absent, 0),
      totalHalfDay: byEmployee.reduce((s, e) => s + e.halfDay, 0),
      totalEarlyCheckout: byEmployee.reduce((s, e) => s + e.earlyCheckout, 0),
      totalOvertime: byEmployee.reduce((s, e) => s + e.overtime, 0),
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
