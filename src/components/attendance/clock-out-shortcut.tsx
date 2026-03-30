"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type GateStatus = {
  hasEmployee: boolean;
  checkedIn: boolean;
  checkedOut: boolean;
};

/**
 * Reads today's attendance gate status for the current signed-in user.
 * It drives conditional rendering of the "Clock Out" shortcut from app headers.
 */
async function loadGateStatus(): Promise<GateStatus | null> {
  try {
    const res = await fetch("/api/attendance/gate-status", { cache: "no-store" });
    const json = (await res.json()) as { success?: boolean; data?: GateStatus };
    if (!json.success || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

/**
 * Header shortcut shown only when user has clocked in today and not clocked out yet.
 * Navigates to `/attendance/check-in` where the existing selfie + GPS clock-out flow runs.
 */
export function ClockOutShortcut() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  const refresh = useCallback(async () => {
    const gate = await loadGateStatus();
    const shouldShow = Boolean(gate?.hasEmployee && gate.checkedIn && !gate.checkedOut);
    setShow(shouldShow);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (pathname === "/attendance/check-in" || !show) return null;
  const next = encodeURIComponent(pathname || "/dashboard");

  return (
    <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
      <Link href={`/attendance/check-in?next=${next}`} aria-label="Clock out">
        <LogOut size={14} />
        Clock Out
      </Link>
    </Button>
  );
}
