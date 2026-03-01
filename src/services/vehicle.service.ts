import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { Vehicle } from "@prisma/client";

export const createVehicleSchema = z.object({
  plateNumber: z.string().min(1).max(20),
  vehicleType: z.enum(["TRUCK", "VAN", "MOTORCYCLE"]),
  capacity: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  status: z.enum(["AVAILABLE", "IN_USE", "MAINTENANCE"]).optional(),
});

export class VehicleService {
  static async createVehicle(
    data: z.infer<typeof createVehicleSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Vehicle> {
    const parsed = createVehicleSchema.parse(data);

    const existing = await prisma.vehicle.findFirst({
      where: { plateNumber: parsed.plateNumber, deletedAt: null },
    });
    if (existing) throw new Error("Vehicle with this plate number already exists");

    const vehicle = await prisma.vehicle.create({
      data: {
        plateNumber: parsed.plateNumber,
        vehicleType: parsed.vehicleType,
        capacity: parsed.capacity ?? null,
        status: "AVAILABLE",
        notes: parsed.notes ?? null,
      },
    });

    await AuditService.logCreate({
      userId, userRole, ipAddress,
      entityType: "Vehicle", entityId: vehicle.id, entityLabel: vehicle.plateNumber,
      data: { plateNumber: vehicle.plateNumber, vehicleType: vehicle.vehicleType, capacity: vehicle.capacity },
    });

    return vehicle;
  }

  static async updateVehicle(
    id: string,
    data: z.infer<typeof updateVehicleSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Vehicle> {
    const parsed = updateVehicleSchema.parse(data);

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle || vehicle.deletedAt) throw new Error("Vehicle not found");

    if (parsed.plateNumber && parsed.plateNumber !== vehicle.plateNumber) {
      const existing = await prisma.vehicle.findFirst({
        where: { plateNumber: parsed.plateNumber, deletedAt: null, id: { not: id } },
      });
      if (existing) throw new Error("Vehicle with this plate number already exists");
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        plateNumber: parsed.plateNumber ?? undefined,
        vehicleType: parsed.vehicleType ?? undefined,
        capacity: parsed.capacity ?? undefined,
        status: parsed.status ?? undefined,
        notes: parsed.notes ?? undefined,
      },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "Vehicle", entityId: id, entityLabel: updated.plateNumber,
      oldData: vehicle as unknown as Record<string, unknown>,
      newData: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  static async deleteVehicle(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<void> {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle || vehicle.deletedAt) throw new Error("Vehicle not found");

    const activeTrip = await prisma.trip.findFirst({
      where: { vehicleId: id, status: { in: ["PLANNED", "IN_PROGRESS"] }, deletedAt: null },
    });
    if (activeTrip) throw new Error("Cannot delete a vehicle that is assigned to an active trip");

    await prisma.vehicle.update({ where: { id }, data: { deletedAt: new Date() } });

    await AuditService.logDelete({
      userId, userRole, ipAddress,
      entityType: "Vehicle", entityId: id, entityLabel: vehicle.plateNumber,
      data: { plateNumber: vehicle.plateNumber, vehicleType: vehicle.vehicleType },
    });
  }

  static async getVehicle(id: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        trips: {
          where: { deletedAt: null },
          orderBy: { tripDate: "desc" },
          take: 10,
          select: { id: true, tripNumber: true, status: true, tripDate: true },
        },
      },
    });
    if (!vehicle || vehicle.deletedAt) throw new Error("Vehicle not found");
    return vehicle;
  }

  static async listVehicles(params: PaginationParams): Promise<PaginatedResponse<Vehicle>> {
    const { page, pageSize, search } = params;

    const where: Record<string, unknown> = { deletedAt: null };
    if (search) {
      where.OR = [
        { plateNumber: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.vehicle.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}
