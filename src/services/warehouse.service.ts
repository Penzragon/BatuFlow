import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";

/**
 * Service layer for warehouse and warehouse-location management.
 * Handles CRUD with soft-delete, default-warehouse uniqueness,
 * and audit logging for all mutating operations.
 */
export class WarehouseService {
  /**
   * Lists all non-deleted warehouses with their location counts.
   * Ordered by creation date descending.
   */
  static async listWarehouses() {
    return prisma.warehouse.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: { locations: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Retrieves a single warehouse by ID, including all its locations.
   * Throws if the warehouse is not found or has been soft-deleted.
   */
  static async getWarehouse(id: string) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, deletedAt: null },
      include: {
        locations: { orderBy: { name: "asc" } },
      },
    });
    if (!warehouse) {
      throw Object.assign(new Error("Warehouse not found"), { status: 404 });
    }
    return warehouse;
  }

  /**
   * Creates a new warehouse. When isDefault is true, unsets default
   * on all other warehouses first. Logs the creation in the audit trail.
   */
  static async createWarehouse(
    data: { name: string; address?: string; isDefault?: boolean; isActive?: boolean },
    userId: string,
    userRole: string,
    ipAddress?: string
  ) {
    if (data.isDefault) {
      await prisma.warehouse.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name: data.name,
        address: data.address,
        isDefault: data.isDefault ?? false,
        isActive: data.isActive ?? true,
      },
    });

    await AuditService.logCreate({
      userId,
      userRole,
      ipAddress,
      entityType: "Warehouse",
      entityId: warehouse.id,
      entityLabel: warehouse.name,
      data: warehouse as unknown as Record<string, unknown>,
    });

    return warehouse;
  }

  /**
   * Updates an existing warehouse. When isDefault is toggled on,
   * unsets default on all other warehouses. Logs field-level diffs
   * in the audit trail.
   */
  static async updateWarehouse(
    id: string,
    data: { name?: string; address?: string; isDefault?: boolean; isActive?: boolean },
    userId: string,
    userRole: string,
    ipAddress?: string
  ) {
    const existing = await WarehouseService.getWarehouse(id);

    if (data.isDefault && !existing.isDefault) {
      await prisma.warehouse.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.warehouse.update({
      where: { id },
      data,
    });

    await AuditService.logUpdate({
      userId,
      userRole,
      ipAddress,
      entityType: "Warehouse",
      entityId: id,
      entityLabel: updated.name,
      oldData: existing as unknown as Record<string, unknown>,
      newData: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  /**
   * Soft-deletes a warehouse by setting deletedAt. Blocks deletion
   * of the default warehouse. Logs the deletion in the audit trail.
   */
  static async deleteWarehouse(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ) {
    const existing = await WarehouseService.getWarehouse(id);

    if (existing.isDefault) {
      throw Object.assign(
        new Error("Cannot delete the default warehouse"),
        { status: 400 }
      );
    }

    const deleted = await prisma.warehouse.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await AuditService.logDelete({
      userId,
      userRole,
      ipAddress,
      entityType: "Warehouse",
      entityId: id,
      entityLabel: existing.name,
      data: existing as unknown as Record<string, unknown>,
    });

    return deleted;
  }

  /**
   * Lists all storage locations within a warehouse, ordered by name.
   */
  static async listLocations(warehouseId: string) {
    return prisma.warehouseLocation.findMany({
      where: { warehouseId },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Creates a new storage location within a warehouse.
   * Verifies the parent warehouse exists before creation.
   */
  static async createLocation(
    warehouseId: string,
    data: { name: string; description?: string; zone?: string }
  ) {
    await WarehouseService.getWarehouse(warehouseId);

    return prisma.warehouseLocation.create({
      data: {
        warehouseId,
        name: data.name,
        description: data.description,
        zone: data.zone,
      },
    });
  }

  /**
   * Updates an existing storage location's name, description, or zone.
   * Throws if the location is not found.
   */
  static async updateLocation(
    locationId: string,
    data: { name?: string; description?: string; zone?: string }
  ) {
    const existing = await prisma.warehouseLocation.findUnique({
      where: { id: locationId },
    });
    if (!existing) {
      throw Object.assign(new Error("Location not found"), { status: 404 });
    }

    return prisma.warehouseLocation.update({
      where: { id: locationId },
      data,
    });
  }

  /**
   * Permanently removes a storage location.
   * Throws if the location is not found.
   */
  static async deleteLocation(locationId: string) {
    const existing = await prisma.warehouseLocation.findUnique({
      where: { id: locationId },
    });
    if (!existing) {
      throw Object.assign(new Error("Location not found"), { status: 404 });
    }

    return prisma.warehouseLocation.delete({
      where: { id: locationId },
    });
  }
}
