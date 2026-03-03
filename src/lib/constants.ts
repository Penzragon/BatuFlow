/**
 * Application-wide constants used across modules.
 */

export const APP_NAME = "BatuFlow";

/** Indonesian VAT rate (PPN) */
export const PPN_RATE = 0.11;

/** Default pagination size for list views */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum rows allowed per data import */
export const MAX_IMPORT_ROWS = 5000;

/** Maximum image file size in bytes (1MB) */
export const MAX_IMAGE_SIZE = 1 * 1024 * 1024;

/** Supported image MIME types for uploads */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Default check-in expiry in hours (configurable via settings) */
export const DEFAULT_CHECKIN_EXPIRY_HOURS = 8;

/** GPS distance warning threshold in meters */
export const DEFAULT_GPS_DISTANCE_THRESHOLD = 500;

/** Discount threshold (%) above which SO requires Manager approval */
export const SO_DISCOUNT_APPROVAL_THRESHOLD = 10;

/** Status color mapping for UI badges */
export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-700",
  submitted: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-700",
  delivered: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  overdue: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-700",
  available: "bg-green-100 text-green-700",
  in_use: "bg-blue-100 text-blue-700",
  maintenance: "bg-yellow-100 text-yellow-700",
  planned: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  picking: "bg-yellow-100 text-yellow-700",
  packed: "bg-blue-100 text-blue-700",
  ready_for_handover: "bg-green-100 text-green-700",
  verified: "bg-blue-100 text-blue-700",
  issued: "bg-blue-100 text-blue-700",
  partially_paid: "bg-yellow-100 text-yellow-700",
  partially_delivered: "bg-yellow-100 text-yellow-700",
  fully_delivered: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-700",
  waiting_approval: "bg-orange-100 text-orange-700",
  posted: "bg-green-100 text-green-700",
  open: "bg-blue-100 text-blue-700",
  checked_out: "bg-green-100 text-green-700",
  stale_open: "bg-orange-100 text-orange-700",
  asset: "bg-blue-100 text-blue-700",
  liability: "bg-red-100 text-red-700",
  equity: "bg-purple-100 text-purple-700",
  revenue: "bg-green-100 text-green-700",
  cogs: "bg-orange-100 text-orange-700",
  expense: "bg-yellow-100 text-yellow-700",
  present: "bg-green-100 text-green-700",
  late: "bg-amber-100 text-amber-700",
  absent: "bg-red-100 text-red-700",
  half_day: "bg-orange-100 text-orange-700",
  pending: "bg-yellow-100 text-yellow-700",
  resigned: "bg-gray-100 text-gray-700",
  new: "bg-gray-100 text-gray-700",
  contacted: "bg-blue-100 text-blue-700",
  qualified: "bg-indigo-100 text-indigo-700",
  proposal: "bg-amber-100 text-amber-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

/** User role display labels */
export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  STAFF: "Staff",
  DRIVER: "Driver",
  WAREHOUSE_STAFF: "Warehouse Staff",
};
