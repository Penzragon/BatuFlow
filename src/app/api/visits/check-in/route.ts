import { apiHandler, successResponse, errorResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { VisitService } from "@/services/visit.service";

export const POST = apiHandler(async (req) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);

  const formData = await req.formData();
  const customerId = formData.get("customerId") as string;
  const gpsLatitude = formData.get("gpsLatitude") ? parseFloat(formData.get("gpsLatitude") as string) : undefined;
  const gpsLongitude = formData.get("gpsLongitude") ? parseFloat(formData.get("gpsLongitude") as string) : undefined;
  const gpsAccuracy = formData.get("gpsAccuracy") ? parseFloat(formData.get("gpsAccuracy") as string) : undefined;
  const notes = formData.get("notes") as string | null;
  const selfieFile = formData.get("selfie") as File | null;

  if (!customerId) return errorResponse("Customer ID is required");

  let selfieBuffer: Buffer | undefined;
  if (selfieFile) {
    const arrayBuffer = await selfieFile.arrayBuffer();
    selfieBuffer = Buffer.from(arrayBuffer);
  }

  const visit = await VisitService.checkIn({
    customerId,
    salespersonId: user.id,
    gpsLatitude,
    gpsLongitude,
    gpsAccuracy,
    selfieBuffer,
    notes: notes ?? undefined,
    userRole: user.role,
    ipAddress: ip ?? undefined,
  });

  return successResponse(visit, 201);
});
