import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { AttendanceService } from "@/services/attendance.service";

/**
 * POST /api/attendance/clock-in
 * Body: { employeeId: string, clockIn?: string (ISO) } or use current user's employee id.
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const body = await req.json().catch(() => ({}));
  const employeeId = body.employeeId as string | undefined;
  const clockIn = body.clockIn ? new Date(body.clockIn) : undefined;

  const id = employeeId ?? (await getEmployeeIdForUser(user.id));
  if (!id) throw Object.assign(new Error("Employee not linked to user"), { status: 403 });

  const attendance = await AttendanceService.clockIn(id, clockIn);
  return successResponse(attendance, 201);
});

async function getEmployeeIdForUser(userId: string): Promise<string | null> {
  const { prisma } = await import("@/lib/db");
  const emp = await prisma.employee.findFirst({
    where: { userId: userId, deletedAt: null },
    select: { id: true },
  });
  return emp?.id ?? null;
}
