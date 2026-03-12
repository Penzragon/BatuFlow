import { apiHandler, errorResponse, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { AttendanceService } from "@/services/attendance.service";

export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const formData = await req.formData();

  const employeeId = (formData.get("employeeId") as string | null) ?? (await getEmployeeIdForUser(user.id));
  if (!employeeId) return errorResponse("Employee not linked to user", 403);

  const lat = Number(formData.get("latitude"));
  const lng = Number(formData.get("longitude"));
  const accuracyRaw = formData.get("accuracy");
  const accuracy = accuracyRaw != null ? Number(accuracyRaw) : undefined;
  const selfie = formData.get("selfie") as File | null;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return errorResponse("GPS is required", 400);
  if (!selfie) return errorResponse("Selfie is required", 400);

  const buffer = Buffer.from(await selfie.arrayBuffer());
  const attendance = await AttendanceService.clockIn({
    employeeId,
    latitude: lat,
    longitude: lng,
    accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
    selfieBuffer: buffer,
  });

  return successResponse(attendance, 201);
});

async function getEmployeeIdForUser(userId: string): Promise<string | null> {
  const { prisma } = await import("@/lib/db");
  const emp = await prisma.employee.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  return emp?.id ?? null;
}
