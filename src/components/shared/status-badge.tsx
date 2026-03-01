import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * Color-coded status badge used across all modules.
 * Automatically maps status strings to predefined color schemes
 * for consistent visual language throughout the application.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, "_");
  const colorClass =
    STATUS_COLORS[normalizedStatus] || "bg-gray-100 text-gray-700";

  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize border-0",
        colorClass,
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
