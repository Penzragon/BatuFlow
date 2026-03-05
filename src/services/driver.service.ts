import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import { DeliveryOrderService } from "./delivery-order.service";

export const updateDeliveryStatusSchema = z.object({
  deliveryStatus: z.enum(["PICKED_UP", "ON_THE_WAY", "DELIVERED", "FAILED"]),
  failureReason: z.enum(["CUSTOMER_ABSENT", "WRONG_ADDRESS", "CUSTOMER_REFUSED", "OTHER"]).optional(),
  failureNote: z.string().optional(),
  gpsLatitude: z.number().optional(),
  gpsLongitude: z.number().optional(),
});

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PICKED_UP"],
  PICKED_UP: ["ON_THE_WAY"],
  ON_THE_WAY: ["DELIVERED", "FAILED"],
};

/**
 * Handles driver-side operations: viewing assigned trips,
 * updating delivery status per DO, and uploading proof photos.
 */
export class DriverService {
  /**
   * Returns today's trips for the given driver user, including all DOs.
   */
  static async getMyTrips(driverId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const trips = await prisma.trip.findMany({
      where: {
        driverId,
        deletedAt: null,
        status: { in: ["PLANNED", "IN_PROGRESS"] },
        tripDate: { gte: today, lt: tomorrow },
      },
      include: {
        vehicle: { select: { id: true, plateNumber: true, vehicleType: true } },
        deliveryOrders: {
          where: { deletedAt: null },
          include: {
            salesOrder: {
              select: {
                id: true,
                soNumber: true,
                customer: {
                  select: { id: true, name: true, address: true, phone: true, gpsLatitude: true, gpsLongitude: true },
                },
              },
            },
            lines: {
              include: { product: { select: { id: true, name: true, sku: true } } },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { tripDate: "asc" },
    });

    return trips;
  }

  /**
   * Returns delivery history (past trips) for the given driver.
   */
  static async getMyDeliveryHistory(driverId: string, limit = 20) {
    return prisma.trip.findMany({
      where: {
        driverId,
        deletedAt: null,
        status: "COMPLETED",
      },
      include: {
        vehicle: { select: { id: true, plateNumber: true } },
        deliveryOrders: {
          where: { deletedAt: null },
          select: {
            id: true,
            doNumber: true,
            deliveryStatus: true,
            deliveredAt: true,
            salesOrder: {
              select: { customer: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: { tripDate: "desc" },
      take: limit,
    });
  }

  /**
   * Validates the delivery status transition and updates the DO.
   * Requires proof photo for DELIVERED status.
   */
  static async updateDeliveryStatus(
    doId: string,
    driverId: string,
    data: z.infer<typeof updateDeliveryStatusSchema>,
    userRole: string,
    ipAddress?: string
  ) {
    const parsed = updateDeliveryStatusSchema.parse(data);

    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id: doId },
      include: {
        trip: { select: { id: true, driverId: true, status: true } },
        salesOrder: {
          select: { customer: { select: { id: true, name: true } } },
        },
      },
    });

    if (!deliveryOrder || deliveryOrder.deletedAt) throw new Error("Delivery order not found");
    if (!deliveryOrder.trip) throw new Error("Delivery order is not assigned to a trip");
    if (deliveryOrder.trip.driverId !== driverId) throw new Error("You are not the driver for this trip");
    if (deliveryOrder.trip.status !== "IN_PROGRESS") {
      throw new Error("Trip must be in progress to update delivery status");
    }

    const allowed = STATUS_TRANSITIONS[deliveryOrder.deliveryStatus];
    if (!allowed || !allowed.includes(parsed.deliveryStatus)) {
      throw new Error(
        `Cannot transition from ${deliveryOrder.deliveryStatus} to ${parsed.deliveryStatus}`
      );
    }

    if (parsed.deliveryStatus === "FAILED" && !parsed.failureReason) {
      throw new Error("Failure reason is required when marking a delivery as failed");
    }

    const updateData: Record<string, unknown> = {
      deliveryStatus: parsed.deliveryStatus,
    };

    if (parsed.deliveryStatus === "DELIVERED") {
      updateData.deliveredAt = new Date();
    }
    if (parsed.deliveryStatus === "FAILED") {
      updateData.failureReason = parsed.failureReason;
      updateData.failureNote = parsed.failureNote ?? null;
    }

    const updated = await prisma.deliveryOrder.update({
      where: { id: doId },
      data: updateData,
    });

    if (parsed.deliveryStatus === "DELIVERED") {
      await DeliveryOrderService.updateSODeliveryStatus(updated.salesOrderId);
    }

    await AuditService.logUpdate({
      userId: driverId,
      userRole,
      ipAddress,
      entityType: "DeliveryOrder",
      entityId: doId,
      entityLabel: deliveryOrder.doNumber,
      oldData: { deliveryStatus: deliveryOrder.deliveryStatus },
      newData: { deliveryStatus: parsed.deliveryStatus },
    });

    return updated;
  }

  /**
   * Saves the proof-of-delivery photo with a watermark containing:
   * - DO number + customer name
   * - GPS coordinates at time of upload
   * - Timestamp
   */
  static async uploadProofPhoto(
    doId: string,
    driverId: string,
    photoBuffer: Buffer,
    gpsLatitude: number | null,
    gpsLongitude: number | null,
    userRole: string,
    ipAddress?: string
  ) {
    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id: doId },
      include: {
        trip: { select: { driverId: true, status: true } },
        salesOrder: {
          select: { customer: { select: { id: true, name: true } } },
        },
      },
    });

    if (!deliveryOrder || deliveryOrder.deletedAt) throw new Error("Delivery order not found");
    if (!deliveryOrder.trip) throw new Error("Delivery order is not assigned to a trip");
    if (deliveryOrder.trip.driverId !== driverId) throw new Error("You are not the driver for this trip");
    if (deliveryOrder.deliveryStatus !== "ON_THE_WAY") {
      throw new Error("Delivery must be ON_THE_WAY before uploading proof photo");
    }

    const customerName = deliveryOrder.salesOrder.customer.name;
    const proofUrl = await DriverService.processProofPhoto(
      photoBuffer,
      deliveryOrder.doNumber,
      customerName
    );

    const updated = await prisma.deliveryOrder.update({
      where: { id: doId },
      data: {
        deliveryStatus: "DELIVERED",
        proofPhotoUrl: proofUrl,
        proofGpsLat: gpsLatitude,
        proofGpsLng: gpsLongitude,
        deliveredAt: new Date(),
      },
    });

    await AuditService.logUpdate({
      userId: driverId,
      userRole,
      ipAddress,
      entityType: "DeliveryOrder",
      entityId: doId,
      entityLabel: deliveryOrder.doNumber,
      oldData: { deliveryStatus: "ON_THE_WAY", proofPhotoUrl: null },
      newData: { deliveryStatus: "DELIVERED", proofPhotoUrl: proofUrl },
    });

    await DeliveryOrderService.updateSODeliveryStatus(updated.salesOrderId);

    return updated;
  }

  /**
   * Compresses proof photo and returns a data URL (suitable for Vercel).
   * Watermark is applied client-side in the driver UI to avoid server font/glyph issues.
   */
  static async processProofPhoto(
    buffer: Buffer,
    _doNumber: string,
    _customerName: string
  ): Promise<string> {
    const sharp = (await import("sharp")).default;

    const processedBuffer = await sharp(buffer)
      .resize(640, 480, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 70,
        mozjpeg: true,
        chromaSubsampling: "4:2:0",
        progressive: true,
      })
      .toBuffer();

    const base64 = processedBuffer.toString("base64");
    return `data:image/jpeg;base64,${base64}`;
  }

  /**
   * Returns dashboard stats for the driver: today's trips, deliveries completed/total.
   */
  static async getDashboardStats(driverId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const trips = await prisma.trip.findMany({
      where: {
        driverId,
        deletedAt: null,
        tripDate: { gte: today, lt: tomorrow },
      },
      include: {
        deliveryOrders: {
          where: { deletedAt: null },
          select: { id: true, deliveryStatus: true, salesOrder: { select: { customer: { select: { name: true, address: true } } } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const allDOs = trips.flatMap((t) => t.deliveryOrders);
    const totalDeliveries = allDOs.length;
    const completed = allDOs.filter((d) => d.deliveryStatus === "DELIVERED" || d.deliveryStatus === "FAILED").length;

    const nextDO = allDOs.find(
      (d) => d.deliveryStatus === "PENDING" || d.deliveryStatus === "PICKED_UP" || d.deliveryStatus === "ON_THE_WAY"
    );

    return {
      todayTrips: trips.length,
      totalDeliveries,
      completedDeliveries: completed,
      nextDelivery: nextDO ?? null,
    };
  }
}
