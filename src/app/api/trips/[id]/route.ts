import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { TripService } from "@/services/trip.service";

export const GET = apiHandler(async (_req, context) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const trip = await TripService.getTrip(id);
  return successResponse(trip);
});

export const PUT = apiHandler(async (req, context) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json();

  const { prisma } = await import("@/lib/db");
  const { AuditService } = await import("@/services/audit.service");
  const existing = await prisma.trip.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error("Trip not found");
  if (existing.status !== "PLANNED") throw new Error("Only planned trips can be edited");

  const updated = await prisma.trip.update({
    where: { id },
    data: { notes: body.notes ?? existing.notes },
  });

  await AuditService.logUpdate({
    userId: user.id, userRole: user.role, ipAddress: ip ?? undefined,
    entityType: "Trip", entityId: id, entityLabel: existing.tripNumber,
    oldData: { notes: existing.notes },
    newData: { notes: updated.notes },
  });

  return successResponse(updated);
});
