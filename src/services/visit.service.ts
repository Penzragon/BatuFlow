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
  status?: "OPEN" | "CHECKED_OUT" | "STALE_OPEN";
  dateFrom?: string;
  dateTo?: string;
  viewer?: { id: string; role: string };
}

const STALE_AFTER_HOURS = 12;

const formatAsciiTimestamp = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} WIB`;
};

const toAsciiSafe = (value: string, maxLen = 48) =>
  value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);

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
      try {
        selfieUrl = await VisitService.processSelfie(selfieBuffer, customer.name);
      } catch (err) {
        console.warn("[VisitService] Failed to persist check-in selfie, continuing without file:", err instanceof Error ? err.message : err);
        selfieUrl = null;
      }
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

  static async processSelfie(buffer: Buffer, _customerName: string): Promise<string> {
    const sharp = (await import("sharp")).default;

    // Watermark is applied client-side on sales-mobile check-in capture to avoid
    // server runtime font/glyph rendering inconsistencies.
    let quality = 80;
    let processedBuffer = await sharp(buffer)
      .resize(800, 600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();

    while (processedBuffer.length > 1024 * 1024 && quality > 50) {
      quality -= 10;
      processedBuffer = await sharp(processedBuffer)
        .jpeg({ quality })
        .toBuffer();
    }

    return `data:image/jpeg;base64,${processedBuffer.toString("base64")}`;
  }

  static async processCheckoutPhoto(buffer: Buffer, actorUserId: string, customerId: string): Promise<string> {
    const sharp = (await import("sharp")).default;
    const now = new Date();
    const actorLabel = toAsciiSafe(actorUserId || "ACTOR", 20) || "ACTOR";
    const customerLabel = toAsciiSafe(customerId || "CUSTOMER", 20) || "CUSTOMER";
    const watermarkLine1 = `CHECKOUT | ${customerLabel}`;
    const watermarkLine2 = `${formatAsciiTimestamp(now)} | ${actorLabel}`;

    const escapeXml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    const resizedBuffer = await sharp(buffer)
      .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
      .toBuffer();

    const metadata = await sharp(resizedBuffer).metadata();
    const imgWidth = Math.max(1, metadata.width ?? 1280);
    const imgHeight = Math.max(1, metadata.height ?? 1280);
    const watermarkHeight = Math.min(Math.max(48, Math.round(imgWidth * 0.1)), imgHeight);

    const fontSize1 = Math.max(14, Math.round(imgWidth * 0.03));
    const fontSize2 = Math.max(12, Math.round(imgWidth * 0.024));

    const svgText = `<svg width="${imgWidth}" height="${watermarkHeight}">
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.65)"/>
      <text x="10" y="${Math.round(watermarkHeight * 0.42)}" font-family="DejaVu Sans, Noto Sans, Arial, sans-serif" font-size="${fontSize1}" fill="#FFFFFF">${escapeXml(watermarkLine1)}</text>
      <text x="10" y="${Math.round(watermarkHeight * 0.8)}" font-family="DejaVu Sans, Noto Sans, Arial, sans-serif" font-size="${fontSize2}" fill="#FFD700">${escapeXml(watermarkLine2)}</text>
    </svg>`;

    let quality = 80;
    let processedBuffer = await sharp(resizedBuffer)
      .composite([{ input: Buffer.from(svgText), gravity: "south" }])
      .jpeg({ quality })
      .toBuffer();

    while (processedBuffer.length > 1024 * 1024 && quality > 50) {
      quality -= 10;
      processedBuffer = await sharp(processedBuffer)
        .jpeg({ quality })
        .toBuffer();
    }

    return `data:image/jpeg;base64,${processedBuffer.toString("base64")}`;
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

  static async getVisitById(id: string, viewer: { id: string; role: string }) {
    const where: Record<string, unknown> = { id };
    if (viewer.role === "STAFF") {
      where.salespersonId = viewer.id;
    }

    const visit = await prisma.customerVisit.findFirst({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            address: true,
            gpsLatitude: true,
            gpsLongitude: true,
          },
        },
        salesperson: { select: { id: true, name: true } },
        salesOrders: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            soNumber: true,
            status: true,
            grandTotal: true,
            createdAt: true,
          },
        },
      },
    });

    if (!visit) {
      const err = new Error("Visit not found");
      Object.assign(err, { status: 404 });
      throw err;
    }

    const durationMinutes = visit.checkoutAt
      ? Math.max(0, Math.round((visit.checkoutAt.getTime() - visit.checkInAt.getTime()) / 60000))
      : null;

    return {
      ...visit,
      durationMinutes,
    };
  }

  static async listVisits(params: VisitListParams): Promise<PaginatedResponse<CustomerVisit>> {
    const { page, pageSize, salespersonId, customerId, status, dateFrom, dateTo, search, viewer } = params;

    const where: Record<string, unknown> = {};
    if (viewer?.role === "STAFF") {
      where.salespersonId = viewer.id;
    } else if (salespersonId) {
      where.salespersonId = salespersonId;
    }
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
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
