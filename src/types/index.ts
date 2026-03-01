import { UserRole } from "@prisma/client";

/**
 * Extended session user type that includes role and locale
 * information beyond what NextAuth provides by default.
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  locale: string;
}

/**
 * Standard API response wrapper for consistent
 * response format across all endpoints.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Pagination parameters accepted by list endpoints.
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

/**
 * Paginated response wrapper with metadata.
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Audit trail change entry for field-level diffs.
 */
export interface AuditChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

/**
 * Search result item returned by global search.
 */
export interface SearchResult {
  id: string;
  type: string;
  label: string;
  sublabel?: string;
  url: string;
}

/**
 * Import validation error for a specific row and field.
 */
export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

/**
 * Import validation result after parsing an uploaded file.
 */
export interface ImportValidationResult {
  validRows: Record<string, unknown>[];
  errors: ImportValidationError[];
  totalRows: number;
}

/**
 * Sidebar navigation item definition.
 */
export interface NavItem {
  title: string;
  href: string;
  icon: string;
  module: string;
  badge?: number;
  disabled?: boolean;
  children?: NavItem[];
}
