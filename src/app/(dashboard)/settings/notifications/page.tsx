"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Notification type constants (duplicated here to avoid importing
 * server-only notification.service.ts into a client component).
 */
const NOTIFICATION_TYPES = [
  "low_stock",
  "expense_approval",
  "leave_approval",
  "so_approval",
  "invoice_overdue",
  "pick_list_assigned",
  "trip_assigned",
] as const;

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  low_stock: "Low stock alerts",
  expense_approval: "Expense approval requests",
  leave_approval: "Leave approval requests",
  so_approval: "Sales order approval requests",
  invoice_overdue: "Invoice overdue reminders",
  pick_list_assigned: "Pick list assigned to you",
  trip_assigned: "Delivery trip assigned to you",
};

/**
 * Notification preferences page where users toggle which
 * notification types they want to receive.
 */
export default function NotificationSettingsPage() {
  const t = useTranslations("notifications");
  const [preferences, setPreferences] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/preferences");
      if (res.ok) {
        const { data } = await res.json();
        setPreferences(data ?? {});
      }
    } catch {
      setPreferences({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const handleToggle = async (type: string, enabled: boolean) => {
    setSaving(type);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, enabled }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setPreferences(data ?? preferences);
      }
    } catch {
      setPreferences((p) => ({ ...p, [type]: !enabled }));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {t("notificationSettings")}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Choose which notification types you want to receive.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Toggle each type to enable or disable notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {NOTIFICATION_TYPES.map((type) => (
              <div
                key={type}
                className="flex items-center justify-between gap-4 rounded-lg border p-4"
              >
                <Label
                  htmlFor={`pref-${type}`}
                  className="flex-1 cursor-pointer text-sm font-medium"
                >
                  {NOTIFICATION_LABELS[type]}
                </Label>
                <Switch
                  id={`pref-${type}`}
                  checked={preferences[type] ?? true}
                  onCheckedChange={(enabled) => handleToggle(type, enabled)}
                  disabled={saving === type}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
