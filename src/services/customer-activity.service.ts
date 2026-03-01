import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { ActivityType } from "@prisma/client";

export const createActivitySchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  type: z.enum(["CALL", "VISIT", "NOTE", "EMAIL", "MEETING"]),
  subject: z.string().min(1),
  notes: z.string().optional().nullable(),
  activityAt: z.string().optional(),
}).refine((data) => data.customerId != null || data.leadId != null, {
  message: "Either customerId or leadId must be provided",
});

interface ActivityListParams extends PaginationParams {
  customerId?: string;
  leadId?: string;
  userId?: string;
  type?: ActivityType;
}

export class CustomerActivityService {
  static async listActivities(
    params: ActivityListParams
  ): Promise<PaginatedResponse<{
    id: string;
    type: ActivityType;
    subject: string;
    notes: string | null;
    activityAt: Date;
    createdAt: Date;
    customerId: string | null;
    leadId: string | null;
    userId: string;
    user: { id: string; name: string };
    customer: { id: string; name: string } | null;
    lead: { id: string; name: string } | null;
  }>> {
    const { page, pageSize, customerId, leadId, userId, type } = params;
    const where: {
      customerId?: string;
      leadId?: string;
      userId?: string;
      type?: ActivityType;
    } = {};
    if (customerId) where.customerId = customerId;
    if (leadId) where.leadId = leadId;
    if (userId) where.userId = userId;
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      prisma.customerActivity.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
          lead: { select: { id: true, name: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { activityAt: "desc" },
      }),
      prisma.customerActivity.count({ where }),
    ]);

    return {
      items: items as {
        id: string;
        type: ActivityType;
        subject: string;
        notes: string | null;
        activityAt: Date;
        createdAt: Date;
        customerId: string | null;
        leadId: string | null;
        userId: string;
        user: { id: string; name: string };
        customer: { id: string; name: string } | null;
        lead: { id: string; name: string } | null;
      }[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async createActivity(
    data: z.infer<typeof createActivitySchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ) {
    const parsed = createActivitySchema.parse(data);
    const activity = await prisma.customerActivity.create({
      data: {
        customerId: parsed.customerId ?? null,
        leadId: parsed.leadId ?? null,
        userId,
        type: parsed.type as ActivityType,
        subject: parsed.subject,
        notes: parsed.notes ?? null,
        activityAt: parsed.activityAt ? new Date(parsed.activityAt) : new Date(),
      },
      include: {
        user: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true } },
      },
    });

    await AuditService.logCreate({
      userId,
      userRole,
      ipAddress,
      entityType: "CustomerActivity",
      entityId: activity.id,
      entityLabel: parsed.subject,
      data: { type: activity.type, subject: activity.subject, customerId: activity.customerId, leadId: activity.leadId },
    });

    return activity;
  }

  static async getActivity(id: string) {
    const activity = await prisma.customerActivity.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        customer: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true } },
      },
    });
    if (!activity) throw new Error("Activity not found");
    return activity;
  }
}
