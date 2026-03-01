"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Lock, Calendar } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Human-readable month names for period display (1-indexed: 1 = January) */
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface FiscalPeriod {
  id: string;
  year: number;
  month: number;
  status: string;
  closedBy: string | null;
  closedAt: string | null;
  closer?: { name: string };
  createdAt: string;
}

/**
 * Fiscal Periods management page.
 * Lists all accounting periods, allows generating new periods for a year,
 * and closing open periods (with confirmation). Closed periods prevent
 * further journal postings.
 */
export default function FiscalPeriodsPage() {
  const t = useTranslations("fiscalPeriods");
  const tCommon = useTranslations("common");

  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateYear, setGenerateYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [periodToClose, setPeriodToClose] = useState<FiscalPeriod | null>(null);
  const [closing, setClosing] = useState(false);

  const fetchPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fiscal-periods");
      const json = await res.json();
      if (json.success) {
        setPeriods(json.data ?? []);
      } else {
        toast.error(json.error ?? "Failed to load fiscal periods");
      }
    } catch {
      toast.error("Failed to load fiscal periods");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  /** Opens the generate dialog with current year as default. */
  const openGenerateDialog = () => {
    setGenerateYear(new Date().getFullYear());
    setGenerateDialogOpen(true);
  };

  /** POST to create periods for the given year. */
  const handleGeneratePeriods = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/fiscal-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: generateYear }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(t("generateSuccess"));
        setGenerateDialogOpen(false);
        fetchPeriods();
      } else {
        toast.error(json.error ?? "Failed to generate periods");
      }
    } catch {
      toast.error("Failed to generate periods");
    } finally {
      setGenerating(false);
    }
  };

  /** Opens close confirmation for an open period. */
  const openCloseDialog = (period: FiscalPeriod) => {
    if (period.status !== "OPEN") return;
    setPeriodToClose(period);
    setCloseDialogOpen(true);
  };

  /** POST to close the selected period. */
  const handleClosePeriod = async () => {
    if (!periodToClose) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/fiscal-periods/${periodToClose.id}/close`, {
        method: "POST",
      });
      const json = await res.json();

      if (json.success) {
        toast.success(t("closedSuccess"));
        setCloseDialogOpen(false);
        setPeriodToClose(null);
        fetchPeriods();
      } else {
        toast.error(json.error ?? "Failed to close period");
      }
    } catch {
      toast.error("Failed to close period");
    } finally {
      setClosing(false);
    }
  };

  const closeCloseDialog = () => {
    setCloseDialogOpen(false);
    setPeriodToClose(null);
  };

  /** Format period as "January 2026". */
  const formatPeriod = (year: number, month: number) => {
    const name = MONTH_NAMES[month - 1] ?? String(month);
    return `${name} ${year}`;
  };

  /** Format ISO date string for display. */
  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const sortedPeriods = [...periods].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={openGenerateDialog}>
            <Calendar className="mr-2 h-4 w-4" />
            {t("generatePeriods")}
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              {tCommon("loading")}
            </div>
          ) : sortedPeriods.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {t("noPeriods")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("period")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("closedBy")}</TableHead>
                  <TableHead>{t("closedAt")}</TableHead>
                  <TableHead className="w-[120px]">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPeriods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">
                      {formatPeriod(period.year, period.month)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={period.status} />
                    </TableCell>
                    <TableCell>
                      {period.closedBy && period.closer?.name
                        ? period.closer.name
                        : "—"}
                    </TableCell>
                    <TableCell>{formatDate(period.closedAt)}</TableCell>
                    <TableCell>
                      {period.status === "OPEN" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCloseDialog(period)}
                        >
                          <Lock className="mr-1 h-4 w-4" />
                          {t("closePeriod")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generate Periods Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("generatePeriods")}</DialogTitle>
            <DialogDescription>{t("generateDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="generate-year">{t("year")}</Label>
              <Input
                id="generate-year"
                type="number"
                min={2000}
                max={2100}
                value={generateYear}
                onChange={(e) =>
                  setGenerateYear(parseInt(e.target.value, 10) || new Date().getFullYear())
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGenerateDialogOpen(false)}
              disabled={generating}
            >
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleGeneratePeriods} disabled={generating}>
              {generating ? tCommon("loading") : t("generatePeriods")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Period Confirmation Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={(open) => !open && closeCloseDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("closePeriod")}</DialogTitle>
            <DialogDescription>
              {periodToClose
                ? `${t("closeMessage")} (${formatPeriod(periodToClose.year, periodToClose.month)})`
                : t("closeMessage")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeCloseDialog} disabled={closing}>
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleClosePeriod}
              disabled={closing}
            >
              {closing ? tCommon("loading") : t("closePeriod")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
