"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface JournalLine {
  id: string;
  debit: number;
  credit: number;
  description: string | null;
  account: { code: string; name: string; type: string };
}

interface JournalEntryDetail {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  status: string;
  totalDebit: number;
  totalCredit: number;
  creator: { name: string };
  poster: { name: string } | null;
  postedAt: string | null;
  lines: JournalLine[];
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);

export default function JournalEntryDetailPage() {
  const t = useTranslations("journalEntries");
  const tc = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [entry, setEntry] = useState<JournalEntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const fetchEntry = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/journal-entries/${id}`);
      const json = await res.json();
      if (json.success) setEntry(json.data);
      else toast.error(json.error);
    } catch {
      toast.error("Failed to load journal entry");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  const handlePost = async () => {
    setPosting(true);
    try {
      const res = await fetch(`/api/journal-entries/${id}/post`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t("postedSuccess"));
        fetchEntry();
      } else {
        toast.error(json.error || "Failed to post entry");
      }
    } catch {
      toast.error("Failed to post entry");
    } finally {
      setPosting(false);
    }
  };

  if (loading || !entry) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("entryNumber")}: ${entry.entryNumber}`}
        actions={
          <div className="flex items-center gap-2">
            {entry.status === "DRAFT" && (
              <Button onClick={handlePost} disabled={posting}>
                <CheckCircle className="mr-2 h-4 w-4" />
                {posting ? tc("loading") : t("postEntry")}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => router.push("/finance/journal-entries")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tc("back")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("journalLines")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("accountCode")}</TableHead>
                      <TableHead>{t("accountName")}</TableHead>
                      <TableHead className="text-right">
                        {t("debit")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("credit")}
                      </TableHead>
                      <TableHead>{t("lineDescription")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entry.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="font-mono text-sm">
                          {line.account.code}
                        </TableCell>
                        <TableCell>{line.account.name}</TableCell>
                        <TableCell className="text-right">
                          {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {line.description || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="font-semibold text-right"
                      >
                        {t("totals")}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(entry.totalDebit)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(entry.totalCredit)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>{t("entryDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("status")}</span>
                <StatusBadge status={entry.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("entryDate")}</span>
                <span className="font-medium">
                  {format(new Date(entry.entryDate), "dd MMM yyyy")}
                </span>
              </div>
              {entry.description && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("description")}
                  </span>
                  <span className="font-medium text-right max-w-[180px]">
                    {entry.description}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("referenceType")}
                </span>
                <span className="font-medium">
                  {entry.referenceType ?? "Manual"}
                </span>
              </div>
              {entry.referenceId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("referenceId")}
                  </span>
                  <span className="font-mono text-xs">
                    {entry.referenceId}
                  </span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between">
                <span className="text-muted-foreground">
                  {t("createdBy")}
                </span>
                <span className="font-medium">{entry.creator.name}</span>
              </div>
              {entry.poster && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("postedBy")}
                  </span>
                  <span className="font-medium">{entry.poster.name}</span>
                </div>
              )}
              {entry.postedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("postedAt")}
                  </span>
                  <span>
                    {format(new Date(entry.postedAt), "dd MMM yyyy HH:mm")}
                  </span>
                </div>
              )}

              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between font-semibold">
                  <span>{t("totalDebit")}</span>
                  <span>{formatCurrency(entry.totalDebit)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>{t("totalCredit")}</span>
                  <span>{formatCurrency(entry.totalCredit)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
