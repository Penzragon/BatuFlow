import { apiHandler, errorResponse, successResponse } from "@/lib/api-utils";
import { getClientIp, getCurrentUser } from "@/lib/auth-utils";
import { GpsReasonCode } from "@prisma/client";
import { VisitService } from "@/services/visit.service";

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/jpg", "image/webp"];
const MAX_PHOTO_SIZE_BYTES = 1024 * 1024;

export const POST = apiHandler(async (req, context) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;

  const formData = await req.formData();

  const gpsLatitude = formData.get("gpsLatitude") ? parseFloat(formData.get("gpsLatitude") as string) : undefined;
  const gpsLongitude = formData.get("gpsLongitude") ? parseFloat(formData.get("gpsLongitude") as string) : undefined;
  const gpsAccuracy = formData.get("gpsAccuracy") ? parseFloat(formData.get("gpsAccuracy") as string) : undefined;
  const gpsReasonCodeRaw = (formData.get("gpsReasonCode") as string | null)?.trim();
  const notes = (formData.get("notes") as string | null)?.trim();
  const overrideReason = (formData.get("overrideReason") as string | null)?.trim();
  const checkoutAtRaw = (formData.get("checkoutAt") as string | null)?.trim();
  const photoFile = formData.get("photo") as File | null;

  if ([gpsLatitude, gpsLongitude, gpsAccuracy].some((value) => Number.isNaN(value))) {
    return errorResponse("Invalid GPS payload");
  }

  let gpsReasonCode: GpsReasonCode | undefined;
  if (gpsReasonCodeRaw) {
    if (!Object.values(GpsReasonCode).includes(gpsReasonCodeRaw as GpsReasonCode)) {
      return errorResponse("Invalid gpsReasonCode");
    }
    gpsReasonCode = gpsReasonCodeRaw as GpsReasonCode;
  }

  const hasGpsPair = gpsLatitude != null && gpsLongitude != null;
  if (!hasGpsPair && !gpsReasonCode) {
    return errorResponse("gpsReasonCode is required when GPS is unavailable");
  }

  if ((gpsLatitude == null) !== (gpsLongitude == null)) {
    return errorResponse("gpsLatitude and gpsLongitude must be provided together");
  }

  let checkoutPhotoPath: string | undefined;
  if (photoFile) {
    if (!ALLOWED_PHOTO_TYPES.includes(photoFile.type)) {
      return errorResponse("Invalid photo format. Only JPEG/JPG/WebP are allowed");
    }
    if (photoFile.size > MAX_PHOTO_SIZE_BYTES) {
      return errorResponse("Photo must be 1 MB or smaller");
    }

    const arrayBuffer = await photoFile.arrayBuffer();
    const photoBuffer = Buffer.from(arrayBuffer);
    try {
      checkoutPhotoPath = await VisitService.processCheckoutPhoto(photoBuffer, user.id, id);
    } catch (err) {
      console.warn("[Visits][Checkout] Failed to persist checkout photo, continuing without file:", err instanceof Error ? err.message : err);
      checkoutPhotoPath = undefined;
    }
  }

  let checkoutAt: Date | undefined;
  if (checkoutAtRaw) {
    checkoutAt = new Date(checkoutAtRaw);
    if (Number.isNaN(checkoutAt.getTime())) {
      return errorResponse("Invalid checkoutAt");
    }
  }

  const visit = await VisitService.checkOut({
    visitId: id,
    actorUserId: user.id,
    actorRole: user.role,
    checkoutAt,
    checkoutPhotoPath,
    checkoutNotes: notes,
    gpsLatitude,
    gpsLongitude,
    gpsAccuracy,
    gpsReasonCode,
    overrideReason,
    ipAddress: ip ?? undefined,
  });

  const durationMinutes = visit.checkoutAt
    ? Math.max(0, Math.round((visit.checkoutAt.getTime() - visit.checkInAt.getTime()) / 60000))
    : null;

  return successResponse({
    id: visit.id,
    customerId: visit.customerId,
    salespersonId: visit.salespersonId,
    status: visit.status,
    checkInAt: visit.checkInAt,
    checkoutAt: visit.checkoutAt,
    durationMinutes,
    checkoutPhotoPath: visit.checkoutPhotoPath,
    gps: {
      latitude: visit.checkoutLat,
      longitude: visit.checkoutLng,
      accuracy: visit.checkoutAccuracy,
      reasonCode: visit.gpsReasonCode,
    },
    override: {
      by: visit.overrideBy,
      reason: visit.overrideReason,
    },
  });
});
