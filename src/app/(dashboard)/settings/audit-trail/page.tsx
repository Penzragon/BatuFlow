"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  FilterX,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";

interface AuditChange {
  id: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole: string;
  ipAddress: string | null;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  user: { id: string; name: string; email: string; role: string };
  changes: AuditChange[];
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700 border-0",
  UPDATE: "bg-blue-100 text-blue-700 border-0",
  DELETE: "bg-red-100 text-red-700 border-0",
  APPROVE: "bg-emerald-100 text-emerald-700 border-0",
  REJECT: "bg-orange-100 text-orange-700 border-0",
  EXPORT: "bg-purple-100 text-purple-700 border-0",
};

const ENTITY_TYPES = [
  "User",
  "Customer",
  "Product",
  "Warehouse",
  "SalesOrder",
  "Invoice",
  "Employee",
  "ExpenseCategory",
  "RolePermission",
];

const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "REJECT",
  "EXPORT",
];

/**
 * Audit Trail viewer page for ADMIN and MANAGER users.
 * Displays a filterable, paginated table of audit log entries
 * with expandable rows showing field-level change diffs.
 */
export default function AuditTrailPage() {
  const t = useTranslations("audit");
  const tCommon = useTranslations("common");

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const totalPages = Math.ceil(total / pageSize);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search) params.set("search", search);
      if (entityType) params.set("entityType", entityType);
      if (action) params.set("action", action);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/audit?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setEntries(json.data.items);
        setTotal(json.data.total);
      }
    } catch {
      toast.error("Failed to load audit trail");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, entityType, action, dateFrom, dateTo]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const clearFilters = () => {
    setSearch("");
    setEntityType("");
    setAction("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "10000");
      if (search) params.set("search", search);
      if (entityType) params.set("entityType", entityType);
      if (action) params.set("action", action);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/audit?${params.toString()}`);
      const json = await res.json();
      if (!json.success) {
        toast.error("Export failed");
        return;
      }

      const rows = json.data.items as AuditEntry[];
      const csvHeader =
        "Timestamp,User,Role,Action,Entity Type,Entity Label,IP Address\n";
      const csvBody = rows
        .map(
          (r: AuditEntry) =>
            `"${new Date(r.timestamp).toLocaleString()}","${r.user.name}","${r.userRole}","${r.action}","${r.entityType}","${r.entityLabel ?? ""}","${r.ipAddress ?? ""}"`
        )
        .join("\n");

      const blob = new Blob([csvHeader + csvBody], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Audit trail exported");
    } catch {
      toast.error("Export failed");
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            {tCommon("export")}
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search entity label..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>

            <Select
              value={entityType}
              onValueChange={(v) => {
                setEntityType(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("entityType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {ENTITY_TYPES.map((et) => (
                  <SelectItem key={et} value={et}>
                    {et}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={action}
              onValueChange={(v) => {
                setAction(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t("action")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {AUDIT_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-[150px]"
              placeholder="From"
            />

            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-[150px]"
              placeholder="To"
            />

            <Button variant="ghost" size="icon" onClick={clearFilters}>
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>{t("action")}</TableHead>
                  <TableHead>{t("entityType")}</TableHead>
                  <TableHead>Entity Label</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {tCommon("noData")}
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <React.Fragment key={entry.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() =>
                          setExpandedId(
                            expandedId === entry.id ? null : entry.id
                          )
                        }
                      >
                        <TableCell className="w-8 px-2">
                          {entry.changes.length > 0 &&
                            (expandedId === entry.id ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            ))}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDate(entry.timestamp)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.user.name}
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.userRole}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={ACTION_COLORS[entry.action] ?? ""}
                          >
                            {entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.entityType}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {entry.entityLabel ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.ipAddress ?? "—"}
                        </TableCell>
                      </TableRow>

                      {/* Expanded change details */}
                      {expandedId === entry.id &&
                        entry.changes.length > 0 && (
                          <TableRow key={`${entry.id}-changes`}>
                            <TableCell colSpan={8} className="bg-muted/20 p-0">
                              <div className="px-10 py-3">
                                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {t("changes")}
                                </p>
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b text-xs text-muted-foreground">
                                      <th className="py-1 text-left">
                                        {t("fieldName")}
                                      </th>
                                      <th className="py-1 text-left">
                                        {t("oldValue")}
                                      </th>
                                      <th className="py-1 text-left">
                                        {t("newValue")}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {entry.changes.map((c) => (
                                      <tr key={c.id} className="border-b last:border-0">
                                        <td className="py-1.5 font-medium">
                                          {c.fieldName}
                                        </td>
                                        <td className="py-1.5">
                                          {c.oldValue ? (
                                            <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">
                                              {c.oldValue}
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground">
                                              —
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-1.5">
                                          {c.newValue ? (
                                            <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-700">
                                              {c.newValue}
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground">
                                              —
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total} row(s) total
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm">
                {page} / {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
