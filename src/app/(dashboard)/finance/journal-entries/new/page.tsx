"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Account {
  id: string;
  code: string;
  name: string;
}

interface JournalLine {
  accountId: string;
  debit: number;
  credit: number;
  description: string;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);

const emptyLine = (): JournalLine => ({
  accountId: "",
  debit: 0,
  credit: 0,
  description: "",
});

export default function CreateJournalEntryPage() {
  const t = useTranslations("journalEntries");
  const tc = useTranslations("common");
  const router = useRouter();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);
  const [submitting, setSubmitting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts?pageSize=200");
      const json = await res.json();
      if (json.success) setAccounts(json.data?.items ?? []);
    } catch {
      toast.error("Failed to load accounts");
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (index: number) => {
    if (lines.length <= 2) {
      toast.error(t("minimumLines"));
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLine = (
    index: number,
    field: keyof JournalLine,
    value: string | number
  ) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const handleSubmit = async () => {
    if (!entryDate) {
      toast.error(t("dateRequired"));
      return;
    }

    const validLines = lines.filter(
      (l) => l.accountId && (l.debit > 0 || l.credit > 0)
    );
    if (validLines.length < 2) {
      toast.error(t("minimumLines"));
      return;
    }

    if (!isBalanced) {
      toast.error(t("unbalancedError"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryDate,
          description: description || undefined,
          lines: validLines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit || 0,
            credit: l.credit || 0,
            description: l.description || undefined,
          })),
        }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(t("created"));
        router.push(`/finance/journal-entries/${json.data.id}`);
      } else {
        toast.error(json.error || "Failed to create journal entry");
      }
    } catch {
      toast.error("Failed to create journal entry");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("createEntry")}
        actions={
          <Button
            variant="outline"
            onClick={() => router.push("/finance/journal-entries")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tc("back")}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("entryDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t("entryDate")}</Label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("description")}</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("journalLines")}</CardTitle>
          <Button size="sm" onClick={addLine}>
            <Plus className="mr-1 h-4 w-4" />
            {t("addLine")}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead>{t("account")}</TableHead>
                  <TableHead className="w-[180px] text-right">
                    {t("debit")}
                  </TableHead>
                  <TableHead className="w-[180px] text-right">
                    {t("credit")}
                  </TableHead>
                  <TableHead>{t("lineDescription")}</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-muted-foreground text-center">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={line.accountId}
                        onValueChange={(val) =>
                          updateLine(idx, "accountId", val)
                        }
                      >
                        <SelectTrigger className="min-w-[200px]">
                          <SelectValue placeholder={t("selectAccount")} />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.code} — {acc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        value={line.debit || ""}
                        onChange={(e) =>
                          updateLine(
                            idx,
                            "debit",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        placeholder="0"
                        className="text-right"
                        disabled={line.credit > 0}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        value={line.credit || ""}
                        onChange={(e) =>
                          updateLine(
                            idx,
                            "credit",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        placeholder="0"
                        className="text-right"
                        disabled={line.debit > 0}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={line.description}
                        onChange={(e) =>
                          updateLine(idx, "description", e.target.value)
                        }
                        placeholder={t("lineDescriptionPlaceholder")}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(idx)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow
                  className={!isBalanced && totalDebit + totalCredit > 0
                    ? "bg-red-50"
                    : ""}
                >
                  <TableCell colSpan={2} className="font-semibold text-right">
                    {t("totals")}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      !isBalanced && totalDebit > 0 ? "text-red-600" : ""
                    }`}
                  >
                    {formatCurrency(totalDebit)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      !isBalanced && totalCredit > 0 ? "text-red-600" : ""
                    }`}
                  >
                    {formatCurrency(totalCredit)}
                  </TableCell>
                  <TableCell colSpan={2}>
                    {!isBalanced && totalDebit + totalCredit > 0 && (
                      <span className="text-sm text-red-600 font-medium">
                        {t("unbalancedWarning")}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          <div className="flex justify-end mt-6">
            <Button
              onClick={handleSubmit}
              disabled={submitting || !isBalanced}
            >
              {submitting ? tc("loading") : t("saveAsDraft")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
