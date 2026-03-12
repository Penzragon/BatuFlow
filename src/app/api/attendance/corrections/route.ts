import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { AttendanceService, createCorrectionSchema } from "@/services/attendance.service";
import { prisma } from "@/lib/db";

export const GET = apiHandler(async () => {
  const user = await getCurrentUser();
  const employee = await prisma.employee.findFirst({ where: { userId: user.id }, select: { id: true } });
  const data = await AttendanceService.listCorrectionRequests({ role: user.role, employeeId: employee?.id });
  return successResponse(data);
});

export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const employee = await prisma.employee.findFirst({ where: { userId: user.id }, select: { id: true } });
  if (!employee) throw new Error("Employee not linked to user");

  const body = await req.json();
  const payload = createCorrectionSchema.parse(body);
  const created = await AttendanceService.requestCorrection(employee.id, payload);
  return successResponse(created, 201);
});
