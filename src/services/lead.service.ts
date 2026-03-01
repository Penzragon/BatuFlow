import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import { CustomerService } from "./customer.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { Lead, LeadStatus } from "@prisma/client";

export const createLeadSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  source: z.string().optional().nullable(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"]).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  value: z.number().min(0).optional().nullable(),
});

export const updateLeadSchema = createLeadSchema.partial();

interface LeadListParams extends PaginationParams {
  status?: LeadStatus;
  assignedTo?: string;
}

export class LeadService {
  static async listLeads(params: LeadListParams): Promise<PaginatedResponse<Lead & { assignee: { id: string; name: string } | null }>> {
    const { page, pageSize, search, status, assignedTo } = params;
    const where: { deletedAt: null; status?: LeadStatus; assignedTo?: string; OR?: object[] } = { deletedAt: null };
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          assignee: { select: { id: true, name: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      items: items as (Lead & { assignee: { id: string; name: string } | null })[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getLead(id: string) {
    const lead = await prisma.lead.findFirst({
      where: { id, deletedAt: null },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        customer: { select: { id: true, name: true } },
        activities: {
          orderBy: { activityAt: "desc" },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
    if (!lead) throw new Error("Lead not found");
    return lead;
  }

  static async createLead(
    data: z.infer<typeof createLeadSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Lead> {
    const parsed = createLeadSchema.parse(data);
    const lead = await prisma.lead.create({
      data: {
        name: parsed.name,
        company: parsed.company ?? null,
        phone: parsed.phone ?? null,
        email: parsed.email && parsed.email !== "" ? parsed.email : null,
        source: parsed.source ?? null,
        status: (parsed.status as LeadStatus) ?? "NEW",
        assignedTo: parsed.assignedTo ?? null,
        notes: parsed.notes ?? null,
        value: parsed.value ?? null,
      },
    });

    await AuditService.logCreate({
      userId,
      userRole,
      ipAddress,
      entityType: "Lead",
      entityId: lead.id,
      entityLabel: lead.name,
      data: { name: lead.name, status: lead.status },
    });

    return lead;
  }

  static async updateLead(
    id: string,
    data: z.infer<typeof updateLeadSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Lead> {
    const existing = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new Error("Lead not found");

    const parsed = updateLeadSchema.parse(data);
    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.company !== undefined && { company: parsed.company ?? null }),
        ...(parsed.phone !== undefined && { phone: parsed.phone ?? null }),
        ...(parsed.email !== undefined && { email: parsed.email && parsed.email !== "" ? parsed.email : null }),
        ...(parsed.source !== undefined && { source: parsed.source ?? null }),
        ...(parsed.status !== undefined && { status: parsed.status as LeadStatus }),
        ...(parsed.assignedTo !== undefined && { assignedTo: parsed.assignedTo ?? null }),
        ...(parsed.notes !== undefined && { notes: parsed.notes ?? null }),
        ...(parsed.value !== undefined && { value: parsed.value ?? null }),
      },
    });

    await AuditService.logUpdate({
      userId,
      userRole,
      ipAddress,
      entityType: "Lead",
      entityId: id,
      entityLabel: lead.name,
      oldData: { status: existing.status, name: existing.name },
      newData: { status: lead.status, name: lead.name },
    });

    return lead;
  }

  static async deleteLead(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<void> {
    const existing = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new Error("Lead not found");

    await prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await AuditService.logDelete({
      userId,
      userRole,
      ipAddress,
      entityType: "Lead",
      entityId: id,
      entityLabel: existing.name,
      data: { id, name: existing.name, status: existing.status },
    });
  }

  /**
   * Convert lead to customer: create a new Customer from lead data and set lead.customerId.
   */
  static async convertToCustomer(
    leadId: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<{ customerId: string; lead: Lead }> {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
    });
    if (!lead) throw new Error("Lead not found");
    if (lead.customerId) throw new Error("Lead is already converted to a customer");

    const customer = await CustomerService.createCustomer(
      {
        name: lead.name,
        phone: lead.phone ?? undefined,
        email: lead.email ?? undefined,
        address: lead.company ?? undefined,
        salespersonId: lead.assignedTo ?? undefined,
      },
      userId,
      userRole,
      ipAddress
    );

    await prisma.lead.update({
      where: { id: leadId },
      data: { customerId: customer.id, status: "WON" as LeadStatus },
    });

    const updatedLead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    await AuditService.logUpdate({
      userId,
      userRole,
      ipAddress,
      entityType: "Lead",
      entityId: leadId,
      entityLabel: lead.name,
      oldData: { customerId: null, status: lead.status },
      newData: { customerId: customer.id, status: "WON" },
    });

    return { customerId: customer.id, lead: updatedLead! };
  }
}
