import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { Employee } from "@prisma/client";

export const createEmployeeSchema = z.object({
  name: z.string().min(1).max(200),
  nik: z.string().max(50).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  position: z.string().max(100).optional().nullable(),
  joinDate: z.string().optional().nullable(),
  basicSalary: z.number().min(0).default(0),
  allowances: z.number().min(0).default(0),
  deductions: z.number().min(0).default(0),
  employmentType: z.enum(["PERMANENT", "CONTRACT"]).default("PERMANENT"),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  bankAccount: z.string().max(100).optional().nullable(),
  bankName: z.string().max(100).optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  status: z.enum(["ACTIVE", "RESIGNED"]).optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

interface EmployeeListParams extends PaginationParams {
  status?: string;
  department?: string;
}

export class EmployeeService {
  static async listEmployees(
    params: EmployeeListParams
  ): Promise<PaginatedResponse<Employee>> {
    const { page, pageSize, search, status, department } = params;

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (department) where.department = department;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { nik: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.employee.count({ where }),
    ]);

    return {
      items: items as unknown as Employee[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getEmployee(id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    if (!employee) throw new Error("Employee not found");
    return employee;
  }

  static async createEmployee(
    data: z.infer<typeof createEmployeeSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Employee> {
    const parsed = createEmployeeSchema.parse(data);

    if (parsed.nik) {
      const existing = await prisma.employee.findFirst({
        where: { nik: parsed.nik, deletedAt: null },
      });
      if (existing) throw new Error("Employee with this NIK already exists");
    }

    if (parsed.userId) {
      const userLinked = await prisma.employee.findFirst({
        where: { userId: parsed.userId, deletedAt: null },
      });
      if (userLinked) throw new Error("User is already linked to another employee");
    }

    const employee = await prisma.employee.create({
      data: {
        name: parsed.name,
        nik: parsed.nik ?? null,
        department: parsed.department ?? null,
        position: parsed.position ?? null,
        joinDate: parsed.joinDate ? new Date(parsed.joinDate) : null,
        basicSalary: parsed.basicSalary,
        allowances: parsed.allowances,
        deductions: parsed.deductions,
        employmentType: parsed.employmentType,
        phone: parsed.phone ?? null,
        email: parsed.email ?? null,
        address: parsed.address ?? null,
        bankAccount: parsed.bankAccount ?? null,
        bankName: parsed.bankName ?? null,
        userId: parsed.userId ?? null,
      },
    });

    await AuditService.logCreate({
      userId, userRole, ipAddress,
      entityType: "Employee", entityId: employee.id, entityLabel: employee.name,
      data: { name: employee.name, nik: employee.nik, department: employee.department },
    });

    return employee;
  }

  static async updateEmployee(
    id: string,
    data: z.infer<typeof updateEmployeeSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Employee> {
    const parsed = updateEmployeeSchema.parse(data);
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new Error("Employee not found");

    if (parsed.nik != null && parsed.nik !== existing.nik) {
      const dup = await prisma.employee.findFirst({
        where: { nik: parsed.nik, deletedAt: null, id: { not: id } },
      });
      if (dup) throw new Error("Employee with this NIK already exists");
    }

    if (parsed.userId !== undefined && parsed.userId !== existing.userId) {
      if (parsed.userId) {
        const userLinked = await prisma.employee.findFirst({
          where: { userId: parsed.userId, deletedAt: null, id: { not: id } },
        });
        if (userLinked) throw new Error("User is already linked to another employee");
      }
    }

    const oldData = {
      name: existing.name,
      nik: existing.nik,
      department: existing.department,
      position: existing.position,
      basicSalary: existing.basicSalary,
      allowances: existing.allowances,
      deductions: existing.deductions,
      status: existing.status,
    };

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.nik !== undefined && { nik: parsed.nik ?? null }),
        ...(parsed.department !== undefined && { department: parsed.department ?? null }),
        ...(parsed.position !== undefined && { position: parsed.position ?? null }),
        ...(parsed.joinDate !== undefined && { joinDate: parsed.joinDate ? new Date(parsed.joinDate) : null }),
        ...(parsed.basicSalary !== undefined && { basicSalary: parsed.basicSalary }),
        ...(parsed.allowances !== undefined && { allowances: parsed.allowances }),
        ...(parsed.deductions !== undefined && { deductions: parsed.deductions }),
        ...(parsed.employmentType !== undefined && { employmentType: parsed.employmentType }),
        ...(parsed.phone !== undefined && { phone: parsed.phone ?? null }),
        ...(parsed.email !== undefined && { email: parsed.email ?? null }),
        ...(parsed.address !== undefined && { address: parsed.address ?? null }),
        ...(parsed.bankAccount !== undefined && { bankAccount: parsed.bankAccount ?? null }),
        ...(parsed.bankName !== undefined && { bankName: parsed.bankName ?? null }),
        ...(parsed.userId !== undefined && { userId: parsed.userId ?? null }),
        ...(parsed.status !== undefined && { status: parsed.status as "ACTIVE" | "RESIGNED" }),
      },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "Employee", entityId: id, entityLabel: updated.name,
      oldData,
      newData: {
        name: updated.name,
        nik: updated.nik,
        department: updated.department,
        position: updated.position,
        basicSalary: updated.basicSalary,
        allowances: updated.allowances,
        deductions: updated.deductions,
        status: updated.status,
      },
    });

    return updated;
  }

  static async deleteEmployee(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<void> {
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new Error("Employee not found");

    await prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await AuditService.logDelete({
      userId, userRole, ipAddress,
      entityType: "Employee", entityId: id, entityLabel: employee.name,
      data: { name: employee.name, nik: employee.nik },
    });
  }

  static async getActiveEmployees(): Promise<Employee[]> {
    return prisma.employee.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      orderBy: { name: "asc" },
    });
  }
}
