"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

interface AchievementRow {
  targetId: string;
  salespersonId: string;
  salespersonName: string;
  periodMonth: number;
  periodYear: number;
  targetAmount: number;
  actualAmount: number;
  achievementPercent: number;
}

export default function SalesTargetsPage() {
  const t = useTranslations("salesTargets");
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
  const [showSetTarget, setShowSetTarget] = useState(false);
  const [targetSalespersonId, setTargetSalespersonId] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAchievement = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/sales-targets/achievement?periodYear=${periodYear}&periodMonth=${periodMonth}`
      );
      const json = await res.json();
      if (json.success) setAchievements(json.data ?? []);
    } catch {
      setAchievements([]);
    } finally {
      setLoading(false);
    }
  }, [periodYear, periodMonth]);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/users?pageSize=200");
    const json = await res.json();
    if (json.success && json.data?.items) setUsers(json.data.items);
  }, []);

  useEffect(() => {
    fetchAchievement();
  }, [fetchAchievement]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSetTarget = async () => {
    if (!targetSalespersonId || !targetAmount || parseFloat(targetAmount) < 0) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/sales-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salespersonId: targetSalespersonId,
          periodMonth,
          periodYear,
          targetAmount: parseFloat(targetAmount),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowSetTarget(false);
        setTargetSalespersonId("");
        setTargetAmount("");
        fetchAchievement();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const months = [
    { value: 1, label: "Jan" }, { value: 2, label: "Feb" }, { value: 3, label: "Mar" }, { value: 4, label: "Apr" },
    { value: 5, label: "May" }, { value: 6, label: "Jun" }, { value: 7, label: "Jul" }, { value: 8, label: "Aug" },
    { value: 9, label: "Sep" }, { value: 10, label: "Oct" }, { value: 11, label: "Nov" }, { value: 12, label: "Dec" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>{t("title")}</CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={String(periodMonth)}
                onValueChange={(v) => setPeriodMonth(parseInt(v, 10))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(periodYear)}
                onValueChange={(v) => setPeriodYear(parseInt(v, 10))}
              >
                <SelectTrigger className="w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[periodYear - 1, periodYear, periodYear + 1].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setShowSetTarget(true)}>
                {t("setTarget")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : achievements.length === 0 ? (
            <p className="text-muted-foreground">{t("noTargets")}</p>
          ) : (
            <div className="space-y-4">
              {achievements.map((row) => (
                <div key={row.targetId ?? row.salespersonId} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{row.salespersonName}</p>
                    <span className="text-sm font-semibold">{row.achievementPercent}%</span>
                  </div>
                  <Progress value={Math.min(row.achievementPercent, 100)} className="h-2 mb-2" />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{t("actualAmount")}: {formatCurrency(row.actualAmount)}</span>
                    <span>{t("targetAmount")}: {formatCurrency(row.targetAmount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showSetTarget && (
        <Card>
          <CardHeader>
            <CardTitle>{t("setTarget")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
            <div>
              <Label>{t("salesperson")}</Label>
              <Select value={targetSalespersonId} onValueChange={setTargetSalespersonId}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("targetAmount")}</Label>
              <Input
                type="number"
                min="0"
                className="w-[180px]"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {months.find((m) => m.value === periodMonth)?.label} {periodYear}
            </div>
            <Button onClick={handleSetTarget} disabled={submitting}>Save</Button>
            <Button variant="outline" onClick={() => setShowSetTarget(false)}>Cancel</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
