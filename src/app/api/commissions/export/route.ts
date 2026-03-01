import { apiHandler } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { CommissionService } from "@/services/commission.service";

export const GET = apiHandler(async (req: Request) => {
  await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const ids = searchParams.get("ids");
  const commissionIds = ids ? ids.split(",").filter(Boolean) : [];
  if (commissionIds.length === 0) {
    throw new Error("At least one commission id is required (ids=id1,id2)");
  }
  const buffer = await CommissionService.exportCommissionsToExcel(commissionIds);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="commissions-export-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
});
