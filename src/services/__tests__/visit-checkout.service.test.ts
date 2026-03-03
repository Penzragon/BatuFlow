import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    customer: {
      findUnique: vi.fn(),
    },
    customerVisit: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../audit.service", () => ({
  AuditService: {
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logEvent: vi.fn(),
  },
}));

describe("VisitService.checkOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows successful checkout by owner", async () => {
    const { VisitService } = await import("../visit.service");
    const { prisma } = await import("@/lib/db");

    const openVisit = {
      id: "visit-1",
      customerId: "cust-1",
      salespersonId: "staff-1",
      status: "OPEN",
      checkInAt: new Date(),
      checkoutAt: null,
      notes: null,
    };
    const checkedOutVisit = {
      ...openVisit,
      status: "CHECKED_OUT",
      checkoutAt: new Date(),
      checkoutLat: -6.2,
      checkoutLng: 106.8,
      checkoutAccuracy: 12,
      gpsReasonCode: null,
      checkoutPhotoPath: "/uploads/visits/checkout/2026/03/photo.jpg",
      overrideReason: null,
    };

    (prisma.customerVisit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(openVisit);
    (prisma.customerVisit.update as ReturnType<typeof vi.fn>).mockResolvedValue(checkedOutVisit);

    const result = await VisitService.checkOut({
      visitId: "visit-1",
      actorUserId: "staff-1",
      actorRole: "STAFF",
      gpsLatitude: -6.2,
      gpsLongitude: 106.8,
      gpsAccuracy: 12,
      checkoutPhotoPath: "/uploads/visits/checkout/2026/03/photo.jpg",
    });

    expect(result.status).toBe("CHECKED_OUT");
    expect(prisma.customerVisit.update).toHaveBeenCalledTimes(1);
  });

  it("blocks duplicate checkout", async () => {
    const { VisitService } = await import("../visit.service");
    const { prisma } = await import("@/lib/db");

    (prisma.customerVisit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "visit-1",
      customerId: "cust-1",
      salespersonId: "staff-1",
      status: "CHECKED_OUT",
      checkInAt: new Date(),
      checkoutAt: new Date(),
    });

    await expect(
      VisitService.checkOut({
        visitId: "visit-1",
        actorUserId: "staff-1",
        actorRole: "STAFF",
        gpsLatitude: -6.2,
        gpsLongitude: 106.8,
      })
    ).rejects.toThrow("Visit already checked out");
  });

  it("blocks unauthorized staff checkout", async () => {
    const { VisitService } = await import("../visit.service");
    const { prisma } = await import("@/lib/db");

    (prisma.customerVisit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "visit-1",
      customerId: "cust-1",
      salespersonId: "staff-owner",
      status: "OPEN",
      checkInAt: new Date(),
      checkoutAt: null,
      notes: null,
    });

    await expect(
      VisitService.checkOut({
        visitId: "visit-1",
        actorUserId: "staff-2",
        actorRole: "STAFF",
        gpsLatitude: -6.2,
        gpsLongitude: 106.8,
      })
    ).rejects.toMatchObject({ message: "Forbidden", status: 403 });
  });

  it("requires gps reason code when gps is missing", async () => {
    const { VisitService } = await import("../visit.service");
    const { prisma } = await import("@/lib/db");

    (prisma.customerVisit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "visit-1",
      customerId: "cust-1",
      salespersonId: "staff-1",
      status: "OPEN",
      checkInAt: new Date(),
      checkoutAt: null,
      notes: null,
    });

    await expect(
      VisitService.checkOut({
        visitId: "visit-1",
        actorUserId: "staff-1",
        actorRole: "STAFF",
      })
    ).rejects.toThrow("GPS reason code is required when GPS is unavailable");
  });

  it("allows manager override with required reason", async () => {
    const { VisitService } = await import("../visit.service");
    const { prisma } = await import("@/lib/db");

    const openVisit = {
      id: "visit-1",
      customerId: "cust-1",
      salespersonId: "staff-owner",
      status: "OPEN",
      checkInAt: new Date(),
      checkoutAt: null,
      notes: "Checked in",
    };
    const checkedOutVisit = {
      ...openVisit,
      status: "CHECKED_OUT",
      checkoutAt: new Date(),
      checkoutLat: null,
      checkoutLng: null,
      checkoutAccuracy: null,
      gpsReasonCode: "GPS_TIMEOUT",
      checkoutPhotoPath: null,
      overrideReason: "STALE_CLOSURE",
      notes: "Checked in\nCheckout: Force-closed",
    };

    (prisma.customerVisit.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(openVisit);
    (prisma.customerVisit.update as ReturnType<typeof vi.fn>).mockResolvedValue(checkedOutVisit);

    const result = await VisitService.checkOut({
      visitId: "visit-1",
      actorUserId: "manager-1",
      actorRole: "MANAGER",
      overrideReason: "STALE_CLOSURE",
      gpsReasonCode: "GPS_TIMEOUT",
      checkoutNotes: "Force-closed",
    });

    expect(result.status).toBe("CHECKED_OUT");
    expect(prisma.customerVisit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notes: "Checked in\nCheckout: Force-closed",
        }),
      })
    );
  });
});
