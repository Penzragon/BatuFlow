import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import { createNotification } from "./notification.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { Trip } from "@prisma/client";

export const createTripSchema = z.object({
  driverId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  tripDate: z.string().datetime(),
  doIds: z.array(z.string().uuid()).min(1, "At least one delivery order is required"),
  notes: z.string().optional(),
});

export const updateTripSchema = z.object({
  notes: z.string().optional(),
  doIds: z.array(z.string().uuid()).optional(),
});

interface TripListParams extends PaginationParams {
  status?: string;
  driverId?: string;
  date?: string;
}

export class TripService {
  static async generateTripNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TRIP-${year}-`;
    const last = await prisma.trip.findFirst({
      where: { tripNumber: { startsWith: prefix } },
      orderBy: { tripNumber: "desc" },
      select: { tripNumber: true },
    });
    const seq = last ? parseInt(last.tripNumber.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(5, "0")}`;
  }

  static async createTrip(
    data: z.infer<typeof createTripSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Trip> {
    const parsed = createTripSchema.parse(data);

    const driver = await prisma.user.findUnique({ where: { id: parsed.driverId } });
    if (!driver || driver.deletedAt) throw new Error("Driver not found");
    if (driver.role !== "DRIVER") throw new Error("Selected user is not a driver");

    const vehicle = await prisma.vehicle.findUnique({ where: { id: parsed.vehicleId } });
    if (!vehicle || vehicle.deletedAt) throw new Error("Vehicle not found");
    if (vehicle.status === "MAINTENANCE") throw new Error("Vehicle is under maintenance");

    const dos = await prisma.deliveryOrder.findMany({
      where: { id: { in: parsed.doIds }, deletedAt: null },
      include: {
        salesOrder: { select: { id: true, soNumber: true, customer: { select: { id: true, name: true } } } },
      },
    });
    if (dos.length !== parsed.doIds.length) throw new Error("One or more delivery orders not found");

    for (const dOrder of dos) {
      if (dOrder.status !== "CONFIRMED") {
        throw new Error(`Delivery order ${dOrder.doNumber} must be confirmed before adding to a trip`);
      }
      if (dOrder.tripId) {
        throw new Error(`Delivery order ${dOrder.doNumber} is already assigned to another trip`);
      }
    }

    const tripNumber = await TripService.generateTripNumber();
    const tripDate = new Date(parsed.tripDate);

    const trip = await prisma.$transaction(async (tx) => {
      const newTrip = await tx.trip.create({
        data: {
          tripNumber,
          driverId: parsed.driverId,
          vehicleId: parsed.vehicleId,
          status: "PLANNED",
          tripDate,
          notes: parsed.notes ?? null,
          createdBy: userId,
        },
      });

      await tx.deliveryOrder.updateMany({
        where: { id: { in: parsed.doIds } },
        data: { tripId: newTrip.id, deliveryStatus: "PENDING" },
      });

      return newTrip;
    });

    await AuditService.logCreate({
      userId, userRole, ipAddress,
      entityType: "Trip", entityId: trip.id, entityLabel: tripNumber,
      data: { tripNumber, driverId: parsed.driverId, vehicleId: parsed.vehicleId, doCount: parsed.doIds.length },
    });

    await createNotification({
      userId: parsed.driverId,
      title: "Trip assigned",
      message: `Trip ${tripNumber} has been assigned to you with ${parsed.doIds.length} delivery order(s).`,
      entityType: "Trip",
      entityId: trip.id,
    });

    return trip;
  }

  static async startTrip(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Trip> {
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { vehicle: true },
    });
    if (!trip || trip.deletedAt) throw new Error("Trip not found");
    if (trip.status !== "PLANNED") throw new Error("Only planned trips can be started");

    const updated = await prisma.$transaction(async (tx) => {
      const updatedTrip = await tx.trip.update({
        where: { id },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });
      await tx.vehicle.update({
        where: { id: trip.vehicleId },
        data: { status: "IN_USE" },
      });
      return updatedTrip;
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "Trip", entityId: id, entityLabel: trip.tripNumber,
      oldData: { status: "PLANNED" },
      newData: { status: "IN_PROGRESS" },
    });

    return updated;
  }

  static async completeTrip(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Trip> {
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        deliveryOrders: { where: { deletedAt: null }, select: { id: true, deliveryStatus: true } },
      },
    });
    if (!trip || trip.deletedAt) throw new Error("Trip not found");
    if (trip.status !== "IN_PROGRESS") throw new Error("Only in-progress trips can be completed");

    const pending = trip.deliveryOrders.filter(
      (d) => d.deliveryStatus === "PENDING" || d.deliveryStatus === "PICKED_UP" || d.deliveryStatus === "ON_THE_WAY"
    );
    if (pending.length > 0) {
      throw new Error(`${pending.length} delivery order(s) still in progress. Complete or fail all deliveries first.`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedTrip = await tx.trip.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await tx.vehicle.update({
        where: { id: trip.vehicleId },
        data: { status: "AVAILABLE" },
      });
      return updatedTrip;
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "Trip", entityId: id, entityLabel: trip.tripNumber,
      oldData: { status: "IN_PROGRESS" },
      newData: { status: "COMPLETED" },
    });

    return updated;
  }

  static async getTrip(id: string) {
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        driver: { select: { id: true, name: true, email: true } },
        vehicle: { select: { id: true, plateNumber: true, vehicleType: true } },
        creator: { select: { id: true, name: true } },
        deliveryOrders: {
          where: { deletedAt: null },
          include: {
            salesOrder: {
              select: { id: true, soNumber: true, customer: { select: { id: true, name: true, address: true, gpsLatitude: true, gpsLongitude: true } } },
            },
            lines: {
              include: { product: { select: { id: true, name: true, sku: true } } },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!trip || trip.deletedAt) throw new Error("Trip not found");
    return trip;
  }

  static async listTrips(params: TripListParams): Promise<PaginatedResponse<Trip>> {
    const { page, pageSize, search, status, driverId, date } = params;

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (driverId) where.driverId = driverId;
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      where.tripDate = { gte: start, lt: end };
    }
    if (search) {
      where.OR = [
        { tripNumber: { contains: search, mode: "insensitive" } },
        { driver: { name: { contains: search, mode: "insensitive" } } },
        { vehicle: { plateNumber: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        include: {
          driver: { select: { id: true, name: true } },
          vehicle: { select: { id: true, plateNumber: true, vehicleType: true } },
          _count: { select: { deliveryOrders: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { tripDate: "desc" },
      }),
      prisma.trip.count({ where }),
    ]);

    return {
      items: items as unknown as Trip[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Returns all active trips with their DO delivery statuses for the delivery board.
   */
  static async getDeliveryBoard() {
    const trips = await prisma.trip.findMany({
      where: { status: { in: ["PLANNED", "IN_PROGRESS"] }, deletedAt: null },
      include: {
        driver: { select: { id: true, name: true } },
        vehicle: { select: { id: true, plateNumber: true, vehicleType: true } },
        deliveryOrders: {
          where: { deletedAt: null },
          select: {
            id: true,
            doNumber: true,
            deliveryStatus: true,
            proofPhotoUrl: true,
            deliveredAt: true,
            failureReason: true,
            salesOrder: {
              select: { customer: { select: { id: true, name: true, address: true } } },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { tripDate: "asc" },
    });

    return trips;
  }
}
