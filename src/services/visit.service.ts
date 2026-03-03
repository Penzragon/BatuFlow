import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import { DEFAULT_CHECKIN_EXPIRY_HOURS, DEFAULT_GPS_DISTANCE_THRESHOLD } from "@/lib/constants";
import type { PaginatedResponse, PaginationParams } from "@/types";
import { GpsReasonCode, type CustomerVisit } from "@prisma/client";

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

interface CheckOutParams {
  visitId: string;
  actorUserId: string;
  actorRole: string;
  checkoutAt?: Date;
  checkoutPhotoPath?: string;
  checkoutNotes?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAccuracy?: number;
  gpsReasonCode?: GpsReasonCode;
  overrideReason?: string;
  ipAddress?: string;
}

interface VisitListParams extends PaginationParams {
  salespersonId?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  viewer?: { id: string; role: string };
}

const STALE_AFTER_HOURS = 12;

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class VisitService {
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
        status: "OPEN",
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

  static async checkOut(params: CheckOutParams): Promise<CustomerVisit> {
    const {
      visitId,
      actorUserId,
      actorRole,
      checkoutAt,
      checkoutPhotoPath,
      checkoutNotes,
      gpsLatitude,
      gpsLongitude,
      gpsAccuracy,
      gpsReasonCode,
      overrideReason,
      ipAddress,
    } = params;

    const visit = await prisma.customerVisit.findUnique({ where: { id: visitId } });
    if (!visit) {
      const err = new Error("Visit not found");
      Object.assign(err, { status: 404 });
      throw err;
    }

    const staleVisit = await VisitService.markVisitStaleIfNeeded(visit, actorUserId, actorRole, ipAddress);

    if (staleVisit.status === "CHECKED_OUT" || staleVisit.checkoutAt) {
      throw new Error("Visit already checked out");
    }

    const isOwner = staleVisit.salespersonId === actorUserId;
    const isPrivileged = actorRole === "MANAGER" || actorRole === "ADMIN";
    const isForceCheckout = !isOwner;

    if (!isOwner && !isPrivileged) {
      const err = new Error("Forbidden");
      Object.assign(err, { status: 403 });
      throw err;
    }

    if ((isForceCheckout || staleVisit.status === "STALE_OPEN") && !isPrivileged) {
      const err = new Error("Forbidden");
      Object.assign(err, { status: 403 });
      throw err;
    }

    if ((isForceCheckout || staleVisit.status === "STALE_OPEN") && !overrideReason?.trim()) {
      throw new Error("Override reason is required");
    }

    if (gpsLatitude == null || gpsLongitude == null) {
      if (!gpsReasonCode) {
        throw new Error("GPS reason code is required when GPS is unavailable");
      }

      await AuditService.logEvent({
        userId: actorUserId,
        userRole: actorRole,
        ipAddress,
        entityType: "CustomerVisit",
        entityId: staleVisit.id,
        entityLabel: `Visit ${staleVisit.id}`,
        eventName: "VISIT_CHECKOUT_GPS_MISSING",
        metadata: {
          visit_id: staleVisit.id,
          customer_id: staleVisit.customerId,
          actor_user_id: actorUserId,
          actor_role: actorRole,
          event_time: new Date().toISOString(),
          gps_reason_code: gpsReasonCode,
        },
      });
    }

    const updated = await prisma.customerVisit.update({
      where: { id: staleVisit.id },
      data: {
        status: "CHECKED_OUT",
        checkoutAt: checkoutAt ?? new Date(),
        checkoutPhotoPath: checkoutPhotoPath ?? null,
        checkoutLat: gpsLatitude ?? null,
        checkoutLng: gpsLongitude ?? null,
        checkoutAccuracy: gpsAccuracy ?? null,
        gpsReasonCode: gpsReasonCode ?? null,
        overrideBy: isForceCheckout || staleVisit.status === "STALE_OPEN" ? actorUserId : null,
        overrideReason: isForceCheckout || staleVisit.status === "STALE_OPEN" ? overrideReason ?? null : null,
        notes: checkoutNotes?.trim()
          ? [staleVisit.notes, `Checkout: ${checkoutNotes.trim()}`].filter(Boolean).join("\n")
          : undefined,
      },
    });

    await AuditService.logUpdate({
      userId: actorUserId,
      userRole: actorRole,
      ipAddress,
      entityType: "CustomerVisit",
      entityId: updated.id,
      entityLabel: `Visit ${updated.id}`,
      oldData: staleVisit as unknown as Record<string, unknown>,
      newData: updated as unknown as Record<string, unknown>,
      metadata: {
        event_name: isForceCheckout ? "VISIT_CHECKOUT_FORCE" : "VISIT_CHECKOUT_SUCCESS",
        visit_id: updated.id,
        customer_id: updated.customerId,
        actor_user_id: actorUserId,
        actor_role: actorRole,
        event_time: new Date().toISOString(),
        before_status: staleVisit.status,
        after_status: updated.status,
        lat: updated.checkoutLat,
        lng: updated.checkoutLng,
        accuracy: updated.checkoutAccuracy,
        gps_reason_code: updated.gpsReasonCode,
        photo_path: updated.checkoutPhotoPath,
        override_reason: updated.overrideReason,
      },
    });

    return updated;
  }

  private static async markVisitStaleIfNeeded(
    visit: CustomerVisit,
    actorUserId: string,
    actorRole: string,
    ipAddress?: string
  ): Promise<CustomerVisit> {
    if (visit.status !== "OPEN" || visit.checkoutAt) {
      return visit;
    }

    const staleThreshold = new Date(visit.checkInAt);
    staleThreshold.setHours(staleThreshold.getHours() + STALE_AFTER_HOURS);

    if (staleThreshold > new Date()) {
      return visit;
    }

    const staleVisit = await prisma.customerVisit.update({
      where: { id: visit.id },
      data: {
        status: "STALE_OPEN",
        staleMarkedAt: new Date(),
      },
    });

    await AuditService.logUpdate({
      userId: actorUserId,
      userRole: actorRole,
      ipAddress,
      entityType: "CustomerVisit",
      entityId: staleVisit.id,
      entityLabel: `Visit ${staleVisit.id}`,
      oldData: visit as unknown as Record<string, unknown>,
      newData: staleVisit as unknown as Record<string, unknown>,
      metadata: {
        event_name: "VISIT_MARKED_STALE",
        visit_id: staleVisit.id,
        customer_id: staleVisit.customerId,
        actor_user_id: actorUserId,
        actor_role: actorRole,
        event_time: new Date().toISOString(),
        before_status: visit.status,
        after_status: staleVisit.status,
      },
    });

    return staleVisit;
  }

  static async processSelfie(buffer: Buffer, customerName: string): Promise<string> {
    const sharp = (await import("sharp")).default;
    const { mkdir } = await import("fs/promises");
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

  static async processCheckoutPhoto(buffer: Buffer, actorUserId: string, customerId: string): Promise<string> {
    const sharp = (await import("sharp")).default;
    const { mkdir, stat, rename } = await import("fs/promises");
    const path = await import("path");

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const uploadDir = path.join(process.cwd(), "public", "uploads", "visits", "checkout", year, month);
    await mkdir(uploadDir, { recursive: true });

    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const filename = `checkout-${timestamp}.jpg`;
    const filepath = path.join(uploadDir, filename);

    const watermarkText = `${now.toLocaleString("id-ID")} | ${actorUserId} | ${customerId}`;
    const svgText = `<svg width="1000" height="60">
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)"/>
      <text x="10" y="40" font-family="Arial" font-size="24" fill="white">${watermarkText}</text>
    </svg>`;

    await sharp(buffer)
      .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
      .composite([{ input: Buffer.from(svgText), gravity: "south" }])
      .jpeg({ quality: 80 })
      .toFile(filepath);

    const stats = await stat(filepath);
    if (stats.size > 1024 * 1024) {
      await sharp(filepath)
        .jpeg({ quality: 60 })
        .toFile(filepath + ".tmp");
      await rename(filepath + ".tmp", filepath);
    }

    return `/uploads/visits/checkout/${year}/${month}/${filename}`;
  }
  static async getActiveVisit(customerId: string, salespersonId: string): Promise<CustomerVisit | null> {
    return prisma.customerVisit.findFirst({
      where: {
        customerId,
        salespersonId,
        status: "OPEN",
        checkoutAt: null,
      },
      orderBy: { checkInAt: "desc" },
      include: {
        customer: { select: { id: true, name: true } },
      },
    });
  }

  static async listVisits(params: VisitListParams): Promise<PaginatedResponse<CustomerVisit>> {
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
      items: items.map((visit) => {
        const durationMinutes = visit.checkoutAt
          ? Math.max(0, Math.round((visit.checkoutAt.getTime() - visit.checkInAt.getTime()) / 60000))
          : null;

        return {
          ...visit,
          durationMinutes,
        };
      }) as unknown as CustomerVisit[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
