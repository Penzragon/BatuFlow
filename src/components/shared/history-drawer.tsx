"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import { Clock, User } from "lucide-react";
import { format } from "date-fns";

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  userRole: string;
  entityLabel?: string;
  user: { name: string; email: string };
  changes: { fieldName: string; oldValue: string | null; newValue: string | null }[];
}

interface HistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  title?: string;
}

/**
 * Slide-in drawer showing the complete change timeline for a specific record.
 * Displays field-level diffs with color-coded old (red) and new (green) values.
 * Used on every business entity via the History button.
 */
export function HistoryDrawer({
  open,
  onOpenChange,
  entityType,
  entityId,
  title,
}: HistoryDrawerProps) {
  const t = useTranslations("audit");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && entityType && entityId) {
      setLoading(true);
      fetch(`/api/audit?entityType=${entityType}&entityId=${entityId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setEntries(data.data?.items ?? []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, entityType, entityId]);

  const actionColors: Record<string, string> = {
    CREATE: "bg-green-100 text-green-700",
    UPDATE: "bg-blue-100 text-blue-700",
    DELETE: "bg-red-100 text-red-700",
    APPROVE: "bg-green-100 text-green-700",
    REJECT: "bg-red-100 text-red-700",
    EXPORT: "bg-gray-100 text-gray-700",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {title || t("history")}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="mt-4 h-[calc(100vh-120px)] pr-4">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              {t("loading") ?? "Loading..."}
            </div>
          )}
          {!loading && entries.length === 0 && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              {t("noChanges")}
            </div>
          )}
          <div className="space-y-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border bg-white p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Badge
                    className={`rounded-full border-0 text-xs ${actionColors[entry.action] || "bg-gray-100 text-gray-700"}`}
                  >
                    {entry.action}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(entry.timestamp), "dd MMM yyyy HH:mm")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span>
                    {entry.user.name} ({entry.userRole})
                  </span>
                </div>
                {entry.changes.length > 0 && (
                  <div className="space-y-1.5">
                    {entry.changes.map((change, i) => (
                      <div
                        key={i}
                        className="rounded bg-gray-50 p-2 text-xs font-mono"
                      >
                        <span className="font-medium text-gray-600">
                          {change.fieldName}
                        </span>
                        {change.oldValue !== null && (
                          <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-red-600 line-through">
                            {change.oldValue}
                          </span>
                        )}
                        {change.newValue !== null && (
                          <span className="ml-1 rounded bg-green-50 px-1.5 py-0.5 text-green-600">
                            {change.newValue}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
