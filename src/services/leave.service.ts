import { z } from "zod";
import { prisma } from "@/lib/db";
import { createNotification } from "./notification.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { LeaveRequest } from "@prisma/client";

export const createLeaveRequestSchema = z.object({
  employeeId: z.string().uuid(),
  leaveType: z.enum(["ANNUAL", "SICK", "PERSONAL"]),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().max(500).optional().nullable(),
});

interface LeaveListParams extends PaginationParams {
  employeeId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

const ANNUAL_LEAVE_DAYS = 12; // per year

export class LeaveService {
  static async createLeaveRequest(
    data: z.infer<typeof createLeaveRequestSchema>
  ): Promise<LeaveRequest> {
    const parsed = createLeaveRequestSchema.parse(data);
    const start = new Date(parsed.startDate);
    const end = new Date(parsed.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (end < start) throw new Error("End date must be on or after start date");

    let days = 0;
    const d = new Date(start);
    while (d <= end) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) days++; // exclude weekend
      d.setDate(d.getDate() + 1);
    }

    const employee = await prisma.employee.findUnique({
      where: { id: parsed.employeeId },
    });
    if (!employee) throw new Error("Employee not found");

    const leave = await prisma.leaveRequest.create({
      data: {
        employeeId: parsed.employeeId,
        leaveType: parsed.leaveType,
        startDate: start,
        endDate: end,
        days,
        reason: parsed.reason ?? null,
        status: "PENDING",
      },
    });

    const managers = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true, deletedAt: null },
      select: { id: true },
    });
    for (const mgr of managers) {
      await createNotification({
        userId: mgr.id,
        title: "Leave Request Pending",
        message: `${employee.name} requested ${parsed.leaveType} leave for ${days} day(s) (${parsed.startDate} to ${parsed.endDate}).`,
        entityType: "LeaveRequest",
        entityId: leave.id,
      });
    }

    return leave;
  }

  static async approveLeave(
    id: string,
    userId: string
  ): Promise<LeaveRequest> {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!leave) throw new Error("Leave request not found");
    if (leave.status !== "PENDING") throw new Error("Only pending leave requests can be approved");

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedBy: userId,
        approvedAt: new Date(),
        rejectionReason: null,
      },
    });

    if (leave.employee.userId) {
      await createNotification({
        userId: leave.employee.userId,
        title: "Leave Approved",
        message: `Your ${leave.leaveType} leave request (${leave.startDate.toISOString().slice(0, 10)} - ${leave.endDate.toISOString().slice(0, 10)}) has been approved.`,
        entityType: "LeaveRequest",
        entityId: leave.id,
      });
    }

    return updated;
  }

  static async rejectLeave(
    id: string,
    reason: string,
    userId: string
  ): Promise<LeaveRequest> {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!leave) throw new Error("Leave request not found");
    if (leave.status !== "PENDING") throw new Error("Only pending leave requests can be rejected");

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvedBy: userId,
        approvedAt: new Date(),
        rejectionReason: reason,
      },
    });

    if (leave.employee.userId) {
      await createNotification({
        userId: leave.employee.userId,
        title: "Leave Rejected",
        message: `Your ${leave.leaveType} leave request was rejected: ${reason}`,
        entityType: "LeaveRequest",
        entityId: leave.id,
      });
    }

    return updated;
  }

  static async getLeaveBalance(
    employeeId: string,
    year: number
  ): Promise<{ annualTotal: number; annualUsed: number; annualRemaining: number }> {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const approvedAnnual = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        leaveType: "ANNUAL",
        status: "APPROVED",
        startDate: { gte: startOfYear },
        endDate: { lte: endOfYear },
      },
    });

    const annualUsed = approvedAnnual.reduce((sum, l) => sum + l.days, 0);
    return {
      annualTotal: ANNUAL_LEAVE_DAYS,
      annualUsed,
      annualRemaining: Math.max(0, ANNUAL_LEAVE_DAYS - annualUsed),
    };
  }

  static async listLeaveRequests(
    params: LeaveListParams
  ): Promise<PaginatedResponse<LeaveRequest & { employee?: { name: string; department?: string } }>> {
    const { page, pageSize, employeeId, status, dateFrom, dateTo } = params;

    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (dateFrom) where.endDate = { gte: new Date(dateFrom) };
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      where.startDate = where.startDate
        ? { ...(where.startDate as Record<string, unknown>), lte: to }
        : { lte: to };
    }

    const [items, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: { employee: { select: { name: true, department: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return {
      items: items as (LeaveRequest & { employee?: { name: string; department?: string } })[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getLeaveRequest(id: string) {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, department: true, position: true } },
        approver: { select: { id: true, name: true } },
      },
    });
    if (!leave) throw new Error("Leave request not found");
    return leave;
  }

  static async getLeavesByEmployee(
    employeeId: string,
    year?: number
  ): Promise<LeaveRequest[]> {
    const where: {
      employeeId: string;
      startDate?: { lte: Date };
      endDate?: { gte: Date };
    } = { employeeId };
    if (year != null) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
      where.startDate = { lte: endOfYear };
      where.endDate = { gte: startOfYear };
    }

    return prisma.leaveRequest.findMany({
      where,
      orderBy: { startDate: "desc" },
    });
  }
}
