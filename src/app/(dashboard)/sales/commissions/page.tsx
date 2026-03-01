"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Calculator, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";

interface Rule {
  id: string;
  type: string;
  rate: number | null;
  effectiveDate: string;
  endDate: string | null;
  isActive: boolean;
  salesperson: { id: string; name: string; email: string };
}

interface CommissionRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalSales: number;
  totalProfit: number;
  commissionAmount: number;
  status: string;
  salesperson: { id: string; name: string };
}

export default function CommissionsPage() {
  const t = useTranslations("commissions");
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([]);
  const [runs, setRuns] = useState<CommissionRun[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [calcDialogOpen, setCalcDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formSalespersonId, setFormSalespersonId] = useState("");
  const [formType, setFormType] = useState<"PERCENTAGE_SALES" | "PERCENTAGE_PROFIT" | "TIERED">("PERCENTAGE_SALES");
  const [formRate, setFormRate] = useState("");
  const [formEffectiveDate, setFormEffectiveDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formEndDate, setFormEndDate] = useState("");
  const [calcSalespersonId, setCalcSalespersonId] = useState("");
  const [calcPeriodStart, setCalcPeriodStart] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"));
  const [calcPeriodEnd, setCalcPeriodEnd] = useState(format(new Date(), "yyyy-MM-dd"));

  const fetchRules = useCallback(async () => {
    const res = await fetch("/api/commissions/rules");
    const json = await res.json();
    if (json.success) setRules(json.data ?? []);
  }, []);

  const fetchRuns = useCallback(async () => {
    const res = await fetch("/api/commissions?pageSize=50");
    const json = await res.json();
    if (json.success) setRuns(json.data?.items ?? []);
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/users?pageSize=200");
    const json = await res.json();
    if (json.success && json.data?.items) {
      setUsers(json.data.items);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([fetchRules(), fetchRuns(), fetchUsers()]);
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchRules, fetchRuns, fetchUsers]);

  const handleCreateRule = async () => {
    if (!formSalespersonId || !formEffectiveDate) {
      toast.error("Salesperson and effective date are required");
      return;
    }
    if (formType !== "TIERED" && !formRate) {
      toast.error("Rate is required for percentage rules");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/commissions/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salespersonId: formSalespersonId,
          type: formType,
          rate: formType === "TIERED" ? null : parseFloat(formRate) || 0,
          effectiveDate: formEffectiveDate,
          endDate: formEndDate || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Rule created");
        setRuleDialogOpen(false);
        fetchRules();
      } else {
        toast.error(json.error ?? "Failed to create rule");
      }
    } catch {
      toast.error("Failed to create rule");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCalculate = async () => {
    if (!calcSalespersonId || !calcPeriodStart || !calcPeriodEnd) {
      toast.error("Salesperson and period are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salespersonId: calcSalespersonId,
          periodStart: calcPeriodStart,
          periodEnd: calcPeriodEnd,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Commission calculated");
        setCalcDialogOpen(false);
        fetchRuns();
        if (json.data?.id) router.push(`/sales/commissions/${json.data.id}`);
      } else {
        toast.error(json.error ?? "Failed to calculate");
      }
    } catch {
      toast.error("Failed to calculate");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const typeLabel = (type: string) => {
    if (type === "PERCENTAGE_SALES") return t("percentageSales");
    if (type === "PERCENTAGE_PROFIT") return t("percentageProfit");
    return t("tiered");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <>
            <Button variant="outline" onClick={() => setCalcDialogOpen(true)}>
              <Calculator className="mr-2 h-4 w-4" />
              {t("calculate")}
            </Button>
            <Button onClick={() => setRuleDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addRule")}
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("rules")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("noRules")}</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noRules")}</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">{t("salesperson")}</th>
                    <th className="p-3 text-left font-medium">{t("type")}</th>
                    <th className="p-3 text-left font-medium">{t("rate")}</th>
                    <th className="p-3 text-left font-medium">{t("effectiveDate")}</th>
                    <th className="p-3 text-left font-medium">{t("endDate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="p-3">{r.salesperson?.name ?? "-"}</td>
                      <td className="p-3">{typeLabel(r.type)}</td>
                      <td className="p-3">{r.rate != null ? `${r.rate}%` : "-"}</td>
                      <td className="p-3">{format(new Date(r.effectiveDate), "dd MMM yyyy")}</td>
                      <td className="p-3">{r.endDate ? format(new Date(r.endDate), "dd MMM yyyy") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("runs")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noRuns")}</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">{t("salesperson")}</th>
                    <th className="p-3 text-left font-medium">{t("period")}</th>
                    <th className="p-3 text-right font-medium">{t("totalSales")}</th>
                    <th className="p-3 text-right font-medium">{t("commissionAmount")}</th>
                    <th className="p-3 text-left font-medium">{t("status")}</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">{r.salesperson?.name ?? "-"}</td>
                      <td className="p-3">
                        {format(new Date(r.periodStart), "dd MMM yyyy")} – {format(new Date(r.periodEnd), "dd MMM yyyy")}
                      </td>
                      <td className="p-3 text-right">{formatCurrency(r.totalSales)}</td>
                      <td className="p-3 text-right font-medium">{formatCurrency(r.commissionAmount)}</td>
                      <td className="p-3">
                        <StatusBadge status={r.status.toLowerCase()} />
                      </td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/sales/commissions/${r.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addRule")}</DialogTitle>
            <DialogDescription>Create a commission rule for a salesperson.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>{t("salesperson")}</Label>
              <Select value={formSalespersonId} onValueChange={setFormSalespersonId}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("type")}</Label>
              <Select value={formType} onValueChange={(v: "PERCENTAGE_SALES" | "PERCENTAGE_PROFIT" | "TIERED") => setFormType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE_SALES">{t("percentageSales")}</SelectItem>
                  <SelectItem value="PERCENTAGE_PROFIT">{t("percentageProfit")}</SelectItem>
                  <SelectItem value="TIERED">{t("tiered")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formType !== "TIERED" && (
              <div>
                <Label>{t("rate")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formRate}
                  onChange={(e) => setFormRate(e.target.value)}
                  placeholder="e.g. 5"
                />
              </div>
            )}
            <div>
              <Label>{t("effectiveDate")}</Label>
              <Input type="date" value={formEffectiveDate} onChange={(e) => setFormEffectiveDate(e.target.value)} />
            </div>
            <div>
              <Label>{t("endDate")} (optional)</Label>
              <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRule} disabled={submitting}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={calcDialogOpen} onOpenChange={setCalcDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("calculate")}</DialogTitle>
            <DialogDescription>Calculate commission for a salesperson for a period.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>{t("salesperson")}</Label>
              <Select value={calcSalespersonId} onValueChange={setCalcSalespersonId}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("periodStart")}</Label>
              <Input type="date" value={calcPeriodStart} onChange={(e) => setCalcPeriodStart(e.target.value)} />
            </div>
            <div>
              <Label>{t("periodEnd")}</Label>
              <Input type="date" value={calcPeriodEnd} onChange={(e) => setCalcPeriodEnd(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalcDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCalculate} disabled={submitting}>Calculate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
