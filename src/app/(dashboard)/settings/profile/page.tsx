"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Lock, User, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";

interface ActivityEntry {
  id: string;
  timestamp: string;
  action: string;
  entityType: string;
  entityLabel: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700 border-0",
  UPDATE: "bg-blue-100 text-blue-700 border-0",
  DELETE: "bg-red-100 text-red-700 border-0",
  APPROVE: "bg-emerald-100 text-emerald-700 border-0",
  REJECT: "bg-orange-100 text-orange-700 border-0",
  EXPORT: "bg-purple-100 text-purple-700 border-0",
};

/**
 * Profile page accessible to all authenticated users.
 * Displays user info, a change-password form, and
 * a personal activity log of recent audit entries.
 */
export default function ProfilePage() {
  const t = useTranslations("audit");
  const tCommon = useTranslations("common");
  const { data: session, status } = useSession();
  const user = session?.user;
  const isLoadingSession = status === "loading";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const pageSize = 10;
  const totalPages = Math.ceil(activityTotal / pageSize);

  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const res = await fetch(
        `/api/users/me/activity?page=${activityPage}&pageSize=${pageSize}`
      );
      const json = await res.json();
      if (json.success) {
        setActivity(json.data.items);
        setActivityTotal(json.data.total);
      }
    } catch {
      toast.error("Failed to load activity");
    } finally {
      setActivityLoading(false);
    }
  }, [activityPage]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error("Current password is required");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(json.error ?? "Failed to change password");
      }
    } catch {
      toast.error("Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (isLoadingSession) {
    return (
      <div className="space-y-6">
        <PageHeader title="Profile" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" />

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{user?.name ?? "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email ?? "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Role</p>
              <Badge className="bg-blue-100 text-blue-700 border-0">
                {(user?.role as string)?.replace("_", " ") ?? "—"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>
              Enter your current password and choose a new one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="w-full"
            >
              {changingPassword ? tCommon("loading") : "Change Password"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t("myActivity")}
          </CardTitle>
          <CardDescription>
            Your recent actions across the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>{t("action")}</TableHead>
                      <TableHead>{t("entityType")}</TableHead>
                      <TableHead>Entity Label</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activity.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="h-20 text-center text-muted-foreground"
                        >
                          {tCommon("noData")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      activity.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatDate(entry.timestamp)}
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
                          <TableCell className="text-sm">
                            {entry.entityLabel ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activityPage <= 1}
                    onClick={() => setActivityPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    {activityPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activityPage >= totalPages}
                    onClick={() => setActivityPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
