import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import type { Handover } from "@prisma/client";
import type { PaginatedResponse, PaginationParams } from "@/types";

interface HandoverListParams extends PaginationParams {
  status?: string;
}

export class HandoverService {
  static async createHandover(
    tripId: string,
    warehouseStaffId: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Handover> {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        deliveryOrders: {
          where: { status: "CONFIRMED", deletedAt: null },
          include: { pickList: true },
        },
      },
    });
    if (!trip) throw new Error("Trip not found");
    if (trip.status !== "PLANNED") throw new Error("Trip must be in PLANNED status");

    const readyDOs = trip.deliveryOrders.filter(
      (d) => d.pickList && d.pickList.status === "READY_FOR_HANDOVER"
    );
    if (readyDOs.length === 0) {
      throw new Error("No delivery orders with packed pick lists ready for handover");
    }

    const handover = await prisma.handover.create({
      data: {
        tripId,
        warehouseStaffId,
        driverId: trip.driverId,
        status: "PENDING",
        lines: {
          create: readyDOs.map((d) => ({
            deliveryOrderId: d.id,
            confirmed: false,
          })),
        },
      },
      include: { lines: true },
    });

    await AuditService.logCreate({
      userId, userRole, ipAddress,
      entityType: "Handover",
      entityId: handover.id,
      entityLabel: `Handover for ${trip.tripNumber}`,
      data: { tripId, warehouseStaffId, driverId: trip.driverId, doCount: readyDOs.length },
    });

    return handover;
  }

  static async confirmHandoverLine(
    handoverId: string,
    lineId: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ) {
    const handover = await prisma.handover.findUnique({ where: { id: handoverId } });
    if (!handover) throw new Error("Handover not found");
    if (handover.status !== "PENDING") throw new Error("Handover is already confirmed");

    const line = await prisma.handoverLine.findUnique({ where: { id: lineId } });
    if (!line || line.handoverId !== handoverId) throw new Error("Handover line not found");
    if (line.confirmed) throw new Error("Line already confirmed");

    const updated = await prisma.handoverLine.update({
      where: { id: lineId },
      data: { confirmed: true },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "HandoverLine", entityId: lineId, entityLabel: `Handover line`,
      oldData: { confirmed: false },
      newData: { confirmed: true },
    });

    return updated;
  }

  static async completeHandover(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Handover> {
    const handover = await prisma.handover.findUnique({
      where: { id },
      include: { lines: true, trip: true },
    });
    if (!handover) throw new Error("Handover not found");
    if (handover.status !== "PENDING") throw new Error("Handover is already confirmed");

    const unconfirmed = handover.lines.filter((l) => !l.confirmed);
    if (unconfirmed.length > 0) {
      throw new Error(`${unconfirmed.length} lines have not been confirmed yet`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.handover.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });

      await tx.trip.update({
        where: { id: handover.tripId },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });

      await tx.vehicle.update({
        where: { id: handover.trip.vehicleId },
        data: { status: "IN_USE" },
      });
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "Handover", entityId: id, entityLabel: `Handover for ${handover.trip.tripNumber}`,
      oldData: { status: "PENDING" },
      newData: { status: "CONFIRMED" },
    });

    return prisma.handover.findUnique({
      where: { id },
      include: { lines: true },
    }) as Promise<Handover>;
  }

  static async getHandover(id: string) {
    const handover = await prisma.handover.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            deliveryOrder: {
              select: {
                id: true, doNumber: true,
                salesOrder: { select: { customer: { select: { name: true } } } },
              },
            },
          },
        },
        trip: { select: { id: true, tripNumber: true, tripDate: true } },
        warehouseStaff: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true } },
      },
    });
    if (!handover) throw new Error("Handover not found");
    return handover;
  }

  static async listHandovers(params: HandoverListParams): Promise<PaginatedResponse<Handover>> {
    const { page, pageSize, search, status } = params;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { trip: { tripNumber: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.handover.findMany({
        where,
        include: {
          trip: { select: { id: true, tripNumber: true, tripDate: true } },
          warehouseStaff: { select: { id: true, name: true } },
          driver: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.handover.count({ where }),
    ]);

    return {
      items: items as unknown as Handover[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
