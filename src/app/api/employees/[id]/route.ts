import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser, getClientIp } from "@/lib/auth-utils";
import { EmployeeService, updateEmployeeSchema } from "@/services/employee.service";

export const GET = apiHandler(async (_req: Request, context: unknown) => {
  await getCurrentUser();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const employee = await EmployeeService.getEmployee(id);
  return successResponse(employee);
});

export const PUT = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json();
  const data = updateEmployeeSchema.parse(body);
  const employee = await EmployeeService.updateEmployee(id, data, user.id, user.role, ip ?? undefined);
  return successResponse(employee);
});

export const DELETE = apiHandler(async (req: Request, context: unknown) => {
  const user = await getCurrentUser();
  const ip = getClientIp(req);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  await EmployeeService.deleteEmployee(id, user.id, user.role, ip ?? undefined);
  return successResponse({ deleted: true });
});
