import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { DriverService } from "@/services/driver.service";

export const POST = apiHandler(async (req, context) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { doId } = await (context as { params: Promise<{ doId: string }> }).params;

  const formData = await req.formData();
  const file = formData.get("photo") as File | null;
  if (!file) throw new Error("Photo is required");

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const gpsLat = formData.get("gpsLatitude");
  const gpsLng = formData.get("gpsLongitude");

  const updated = await DriverService.uploadProofPhoto(
    doId,
    user.id,
    buffer,
    gpsLat ? parseFloat(gpsLat as string) : null,
    gpsLng ? parseFloat(gpsLng as string) : null,
    user.role,
    ip ?? undefined
  );

  return successResponse(updated);
});
