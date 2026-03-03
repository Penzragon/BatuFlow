import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import { DEFAULT_CHECKIN_EXPIRY_HOURS, DEFAULT_GPS_DISTANCE_THRESHOLD } from "@/lib/constants";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { CustomerVisit } from "@prisma/client";

interface CheckInParams {
  customerId: string;
  salespersonId: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAccuracy?: number;
  selfieBuffer?: Buffer;
  notes?: string;
  userRole: string;
  ipAddress?: string;
}

interface VisitListParams extends PaginationParams {
  salespersonId?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  viewer?: { id: string; role: string };
}

/**
 * Calculates the Haversine distance between two GPS points in meters.
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Handles visit check-in workflows including selfie watermarking,
 * GPS capture and distance validation, and visit expiry management.
 */
export class VisitService {
  /**
   * Creates a visit check-in record. Processes selfie with watermark,
   * calculates distance from the customer's registered GPS coordinates,
   * and sets an expiry time based on system settings.
   */
  static async checkIn(params: CheckInParams): Promise<CustomerVisit & { distanceWarning?: boolean }> {
    const {
      customerId, salespersonId, gpsLatitude, gpsLongitude,
      gpsAccuracy, selfieBuffer, notes, userRole, ipAddress,
    } = params;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, gpsLatitude: true, gpsLongitude: true, salespersonId: true, deletedAt: true, isActive: true },
    });
    if (!customer || customer.deletedAt || !customer.isActive) throw new Error("Customer not found");
    if (userRole === "STAFF" && customer.salespersonId !== salespersonId) {
      throw new Error("Customer not found");
    }

    let selfieUrl: string | null = null;
    if (selfieBuffer) {
      selfieUrl = await VisitService.processSelfie(selfieBuffer, customer.name);
    }

    let distanceFromCustomer: number | null = null;
    let distanceWarning = false;
    if (
      gpsLatitude != null && gpsLongitude != null &&
      customer.gpsLatitude != null && customer.gpsLongitude != null
    ) {
      distanceFromCustomer = haversineDistance(
        gpsLatitude, gpsLongitude,
        customer.gpsLatitude, customer.gpsLongitude
      );
      distanceWarning = distanceFromCustomer > DEFAULT_GPS_DISTANCE_THRESHOLD;
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + DEFAULT_CHECKIN_EXPIRY_HOURS);

    const visit = await prisma.customerVisit.create({
      data: {
        customerId,
        salespersonId,
        selfieUrl,
        gpsLatitude: gpsLatitude ?? null,
        gpsLongitude: gpsLongitude ?? null,
        gpsAccuracy: gpsAccuracy ?? null,
        distanceFromCustomer,
        expiresAt,
        notes: notes ?? null,
      },
    });

    await AuditService.logCreate({
      userId: salespersonId,
      userRole,
      ipAddress,
      entityType: "CustomerVisit",
      entityId: visit.id,
      entityLabel: `Visit at ${customer.name}`,
      data: visit as unknown as Record<string, unknown>,
    });

    return { ...visit, distanceWarning };
  }

  /**
   * Compresses and watermarks the selfie image with customer name + timestamp.
   * Returns the relative path where the processed file is stored.
   */
  static async processSelfie(buffer: Buffer, customerName: string): Promise<string> {
    const sharp = (await import("sharp")).default;
    const { writeFile, mkdir } = await import("fs/promises");
    const path = await import("path");

    const uploadDir = path.join(process.cwd(), "public", "uploads", "visits");
    await mkdir(uploadDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `visit-${timestamp}.jpg`;
    const filepath = path.join(uploadDir, filename);

    const watermarkText = `${customerName} | ${new Date().toLocaleString("id-ID")}`;
    const svgText = `<svg width="800" height="60">
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)"/>
      <text x="10" y="40" font-family="Arial" font-size="24" fill="white">${watermarkText}</text>
    </svg>`;

    await sharp(buffer)
      .resize(800, 600, { fit: "inside", withoutEnlargement: true })
      .composite([{ input: Buffer.from(svgText), gravity: "south" }])
      .jpeg({ quality: 80 })
      .toFile(filepath);

    const stats = await import("fs/promises").then(fs => fs.stat(filepath));
    if (stats.size > 1024 * 1024) {
      await sharp(filepath)
        .jpeg({ quality: 60 })
        .toFile(filepath + ".tmp");
      const { rename } = await import("fs/promises");
      await rename(filepath + ".tmp", filepath);
    }

    return `/uploads/visits/${filename}`;
  }

  /**
   * Finds the currently active (non-expired) visit for a salesperson at a customer.
   */
  static async getActiveVisit(
    customerId: string,
    salespersonId: string
  ): Promise<CustomerVisit | null> {
    return prisma.customerVisit.findFirst({
      where: {
        customerId,
        salespersonId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { checkInAt: "desc" },
      include: {
        customer: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Returns paginated visit log with optional filters.
   */
  static async listVisits(
    params: VisitListParams
  ): Promise<PaginatedResponse<CustomerVisit>> {
    const { page, pageSize, salespersonId, customerId, dateFrom, dateTo, search, viewer } = params;

    const where: Record<string, unknown> = {};
    if (viewer?.role === "STAFF") {
      where.salespersonId = viewer.id;
    } else if (salespersonId) {
      where.salespersonId = salespersonId;
    }
    if (customerId) where.customerId = customerId;
    if (dateFrom || dateTo) {
      where.checkInAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo + "T23:59:59Z") } : {}),
      };
    }
    if (search) {
      where.OR = [
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { salesperson: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.customerVisit.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          salesperson: { select: { id: true, name: true } },
          _count: { select: { salesOrders: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { checkInAt: "desc" },
      }),
      prisma.customerVisit.count({ where }),
    ]);

    return {
      items: items as unknown as CustomerVisit[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
