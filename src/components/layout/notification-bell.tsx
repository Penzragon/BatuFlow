"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

/** Builds the navigation URL for a notification based on entity type and ID. */
function getEntityUrl(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  const routes: Record<string, string> = {
    product: "/inventory/products",
    customer: "/sales/customers",
    warehouse: "/inventory/warehouses",
    expense: "/finance/expenses",
  };
  const base = routes[entityType];
  return base ? `${base}/${entityId}` : null;
}

export function NotificationBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const { data } = await res.json();
        setUnreadCount(data.count);
      }
    } catch {
      // Ignore fetch errors
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "/api/notifications?page=1&pageSize=10"
      );
      if (res.ok) {
        const { data } = await res.json();
        setNotifications(data.items ?? []);
      }
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setUnreadCount(0);
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true }))
        );
      }
    } catch {
      // Ignore
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    const url = getEntityUrl(n.entityType, n.entityId);
    setOpen(false);
    if (url) {
      router.push(url);
    }
    if (!n.isRead) {
      try {
        await fetch("/api/notifications/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: n.id }),
        });
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === n.id ? { ...item, isRead: true } : item
          )
        );
      } catch {
        // Ignore
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-lg"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="xs"
              className="h-7 gap-1"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="size-3.5" />
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[320px]">
          <div className="p-2">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            ) : (
              <div className="space-y-1">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-lg border p-2.5 text-left transition-colors hover:bg-accent",
                      !n.isRead && "bg-accent/50"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.isRead && (
                        <span
                          className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                          aria-hidden
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight">
                          {n.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {n.message}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link
              href="/settings/notifications"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
