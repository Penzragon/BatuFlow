import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import { createNotification } from "./notification.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { PickList } from "@prisma/client";

interface PLListParams extends PaginationParams {
  status?: string;
  assignedTo?: string;
}

export class PickListService {
  static async generatePickListNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PL-${year}-`;
    const last = await prisma.pickList.findFirst({
      where: { pickListNumber: { startsWith: prefix } },
      orderBy: { pickListNumber: "desc" },
      select: { pickListNumber: true },
    });
    const seq = last ? parseInt(last.pickListNumber.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(5, "0")}`;
  }

  static async createPickList(
    deliveryOrderId: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<PickList> {
    const existingPL = await prisma.pickList.findUnique({
      where: { deliveryOrderId },
    });
    if (existingPL) return existingPL;

    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id: deliveryOrderId },
      include: { lines: true },
    });
    if (!deliveryOrder) throw new Error("Delivery order not found");

    const pickListNumber = await PickListService.generatePickListNumber();

    const pickList = await prisma.pickList.create({
      data: {
        pickListNumber,
        deliveryOrderId,
        status: "CREATED",
        createdBy: userId,
        lines: {
          create: deliveryOrder.lines.map((line) => ({
            productId: line.productId,
            productName: line.productName,
            productSku: line.productSku,
            qtyRequired: line.qtyDelivered,
            qtyPicked: 0,
          })),
        },
      },
      include: { lines: true },
    });

    await AuditService.logCreate({
      userId, userRole, ipAddress,
      entityType: "PickList",
      entityId: pickList.id,
      entityLabel: pickListNumber,
      data: { pickListNumber, deliveryOrderId, status: "CREATED" },
    });

    return pickList;
  }

  static async startPicking(
    id: string,
    assignedTo: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<PickList> {
    const pl = await prisma.pickList.findUnique({ where: { id } });
    if (!pl) throw new Error("Pick list not found");
    if (pl.status !== "CREATED") throw new Error("Only newly created pick lists can be started");

    const updated = await prisma.pickList.update({
      where: { id },
      data: { status: "PICKING", assignedTo },
      include: { lines: true },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "PickList", entityId: id, entityLabel: pl.pickListNumber,
      oldData: { status: "CREATED", assignedTo: null },
      newData: { status: "PICKING", assignedTo },
    });

    await createNotification({
      userId: assignedTo,
      title: "Pick list assigned",
      message: `Pick list ${pl.pickListNumber} has been assigned to you.`,
      entityType: "PickList",
      entityId: id,
    });

    return updated;
  }

  static async updatePickLine(
    pickListId: string,
    lineId: string,
    qtyPicked: number,
    notes: string | undefined,
    userId: string,
    userRole: string,
    ipAddress?: string
  ) {
    const pl = await prisma.pickList.findUnique({ where: { id: pickListId } });
    if (!pl) throw new Error("Pick list not found");
    if (!["PICKING", "CREATED"].includes(pl.status)) throw new Error("Pick list is not in picking state");

    const line = await prisma.pickListLine.findUnique({ where: { id: lineId } });
    if (!line || line.pickListId !== pickListId) throw new Error("Pick list line not found");

    const isShortPicked = qtyPicked < line.qtyRequired;

    const updated = await prisma.pickListLine.update({
      where: { id: lineId },
      data: { qtyPicked, isShortPicked, notes: notes ?? line.notes },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "PickListLine", entityId: lineId, entityLabel: `${pl.pickListNumber} - ${line.productSku}`,
      oldData: { qtyPicked: line.qtyPicked },
      newData: { qtyPicked },
    });

    return updated;
  }

  static async completePacking(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<PickList> {
    const pl = await prisma.pickList.findUnique({ where: { id }, include: { lines: true } });
    if (!pl) throw new Error("Pick list not found");
    if (pl.status !== "PICKING") throw new Error("Pick list must be in picking state to complete packing");

    const updated = await prisma.pickList.update({
      where: { id },
      data: { status: "PACKED", packedAt: new Date() },
      include: { lines: true },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "PickList", entityId: id, entityLabel: pl.pickListNumber,
      oldData: { status: "PICKING" },
      newData: { status: "PACKED" },
    });

    return updated;
  }

  static async markReadyForHandover(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<PickList> {
    const pl = await prisma.pickList.findUnique({ where: { id } });
    if (!pl) throw new Error("Pick list not found");
    if (pl.status !== "PACKED") throw new Error("Pick list must be packed before handover");

    const updated = await prisma.pickList.update({
      where: { id },
      data: { status: "READY_FOR_HANDOVER" },
      include: { lines: true },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "PickList", entityId: id, entityLabel: pl.pickListNumber,
      oldData: { status: "PACKED" },
      newData: { status: "READY_FOR_HANDOVER" },
    });

    return updated;
  }

  static async getPickList(id: string) {
    const pl = await prisma.pickList.findUnique({
      where: { id },
      include: {
        lines: { include: { product: { select: { id: true, sku: true, name: true } } } },
        deliveryOrder: {
          select: {
            id: true, doNumber: true,
            salesOrder: { select: { id: true, soNumber: true, customer: { select: { id: true, name: true } } } },
          },
        },
        creator: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });
    if (!pl) throw new Error("Pick list not found");
    return pl;
  }

  static async listPickLists(params: PLListParams): Promise<PaginatedResponse<PickList>> {
    const { page, pageSize, search, status, assignedTo } = params;

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;
    if (search) {
      where.OR = [
        { pickListNumber: { contains: search, mode: "insensitive" } },
        { deliveryOrder: { doNumber: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.pickList.findMany({
        where,
        include: {
          deliveryOrder: {
            select: {
              id: true, doNumber: true,
              salesOrder: { select: { customer: { select: { name: true } } } },
            },
          },
          assignee: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.pickList.count({ where }),
    ]);

    return {
      items: items as unknown as PickList[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
