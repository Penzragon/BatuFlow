import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { MODULES } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

/** Search result for a product. */
export interface ProductSearchResult {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
}

/** Search result for a customer. */
export interface CustomerSearchResult {
  id: string;
  name: string;
  phone: string | null;
  taxId: string | null;
}

/** Search result for a sales order. */
export interface SOSearchResult {
  id: string;
  soNumber: string;
  customerName: string;
  status: string;
}

/** Search result for an invoice. */
export interface InvoiceSearchResult {
  id: string;
  invoiceNumber: string;
  customerName: string;
  status: string;
}

/** Search result for a delivery order. */
export interface DeliveryOrderSearchResult {
  id: string;
  doNumber: string;
  customerName: string;
  status: string;
}

/** Search result for an employee. */
export interface EmployeeSearchResult {
  id: string;
  name: string;
  nik: string | null;
  department: string | null;
}

/** Search result for an expense. */
export interface ExpenseSearchResult {
  id: string;
  expenseNumber: string;
  description: string | null;
  referenceNo: string | null;
  status: string;
}

/** Grouped search results returned by global search. */
export interface GlobalSearchResult {
  products: ProductSearchResult[];
  customers: CustomerSearchResult[];
  salesOrders: SOSearchResult[];
  invoices: InvoiceSearchResult[];
  deliveryOrders: DeliveryOrderSearchResult[];
  employees: EmployeeSearchResult[];
  expenses: ExpenseSearchResult[];
}

/** Recent search record. */
export interface RecentSearchRecord {
  id: string;
  query: string;
  createdAt: Date;
}

/** Maximum number of results per entity type. */
const MAX_RESULTS_PER_TYPE = 5;

/** Maximum number of recent searches per user. */
const MAX_RECENT_SEARCHES = 5;

/**
 * Performs a global search across Products and Customers.
 * Results are limited to 5 per entity type and respect role-based access.
 * Products: search by SKU, name, brand. Requires inventory view permission.
 * Customers: search by name, phone, tax_id. Requires sales view permission.
 *
 * @param query - Search term (min 2 chars recommended)
 * @param userId - Current user ID (unused but kept for future audit/tenant filtering)
 * @param userRole - User role for permission checks
 * @returns Grouped products and customers arrays
 */
export async function globalSearch(
  query: string,
  userId: string,
  userRole: UserRole
): Promise<GlobalSearchResult> {
  const trimmed = query.trim();
  const result: GlobalSearchResult = {
    products: [],
    customers: [],
    salesOrders: [],
    invoices: [],
    deliveryOrders: [],
    employees: [],
    expenses: [],
  };

  const canViewProducts = hasPermission(userRole, MODULES.INVENTORY, "view");
  const canViewCustomers = hasPermission(userRole, MODULES.SALES, "view");
  const canViewDelivery = hasPermission(userRole, MODULES.DELIVERY, "view");
  const canViewHR = hasPermission(userRole, MODULES.HR, "view");
  const canViewExpenses = hasPermission(userRole, MODULES.EXPENSES, "view");

  if (canViewProducts) {
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { sku: { contains: trimmed, mode: "insensitive" } },
          { name: { contains: trimmed, mode: "insensitive" } },
          { brand: { contains: trimmed, mode: "insensitive" } },
        ],
      },
      select: { id: true, sku: true, name: true, brand: true },
      take: MAX_RESULTS_PER_TYPE,
      orderBy: { name: "asc" },
    });
    result.products = products;
  }

  if (canViewCustomers) {
    const customers = await prisma.customer.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { name: { contains: trimmed, mode: "insensitive" } },
          { phone: { contains: trimmed, mode: "insensitive" } },
          { taxId: { contains: trimmed, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, phone: true, taxId: true },
      take: MAX_RESULTS_PER_TYPE,
      orderBy: { name: "asc" },
    });
    result.customers = customers;
  }

  if (canViewCustomers) {
    const salesOrders = await prisma.salesOrder.findMany({
      where: {
        deletedAt: null,
        OR: [
          { soNumber: { contains: trimmed, mode: "insensitive" } },
          { customer: { name: { contains: trimmed, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        soNumber: true,
        status: true,
        customer: { select: { name: true } },
      },
      take: MAX_RESULTS_PER_TYPE,
      orderBy: { createdAt: "desc" },
    });
    result.salesOrders = salesOrders.map((so) => ({
      id: so.id,
      soNumber: so.soNumber,
      customerName: so.customer.name,
      status: so.status,
    }));

    const invoices = await prisma.arInvoice.findMany({
      where: {
        deletedAt: null,
        OR: [
          { invoiceNumber: { contains: trimmed, mode: "insensitive" } },
          { customer: { name: { contains: trimmed, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        customer: { select: { name: true } },
      },
      take: MAX_RESULTS_PER_TYPE,
      orderBy: { createdAt: "desc" },
    });
    result.invoices = invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customer.name,
      status: inv.status,
    }));
  }

  if (canViewDelivery) {
    const deliveryOrders = await prisma.deliveryOrder.findMany({
      where: {
        deletedAt: null,
        OR: [
          { doNumber: { contains: trimmed, mode: "insensitive" } },
          { salesOrder: { customer: { name: { contains: trimmed, mode: "insensitive" } } } },
        ],
      },
      select: {
        id: true,
        doNumber: true,
        status: true,
        salesOrder: { select: { customer: { select: { name: true } } } },
      },
      take: MAX_RESULTS_PER_TYPE,
      orderBy: { createdAt: "desc" },
    });
    result.deliveryOrders = deliveryOrders.map((do_) => ({
      id: do_.id,
      doNumber: do_.doNumber,
      customerName: do_.salesOrder.customer.name,
      status: do_.status,
    }));
  }

  if (canViewHR) {
    const employees = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: trimmed, mode: "insensitive" } },
          { nik: { contains: trimmed, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, nik: true, department: true },
      take: MAX_RESULTS_PER_TYPE,
      orderBy: { name: "asc" },
    });
    result.employees = employees;
  }

  if (canViewExpenses) {
    const expenses = await prisma.expense.findMany({
      where: {
        deletedAt: null,
        OR: [
          { expenseNumber: { contains: trimmed, mode: "insensitive" } },
          { description: { contains: trimmed, mode: "insensitive" } },
          { referenceNo: { contains: trimmed, mode: "insensitive" } },
        ],
      },
      select: { id: true, expenseNumber: true, description: true, referenceNo: true, status: true },
      take: MAX_RESULTS_PER_TYPE,
      orderBy: { createdAt: "desc" },
    });
    result.expenses = expenses.map((e) => ({
      id: e.id,
      expenseNumber: e.expenseNumber,
      description: e.description,
      referenceNo: e.referenceNo,
      status: e.status,
    }));
  }

  return result;
}

/**
 * Fetches the last 5 recent searches for the given user, most recent first.
 *
 * @param userId - User ID
 * @returns Array of recent search records
 */
export async function getRecentSearches(
  userId: string
): Promise<RecentSearchRecord[]> {
  const records = await prisma.recentSearch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: MAX_RECENT_SEARCHES,
    select: { id: true, query: true, createdAt: true },
  });
  return records;
}

/**
 * Saves a search query for the user. Maintains a maximum of 5 recent searches
 * per user by removing the oldest when over the limit.
 *
 * @param userId - User ID
 * @param query - Search query to save (should be trimmed and non-empty)
 */
export async function saveRecentSearch(
  userId: string,
  query: string
): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) return;

  await prisma.recentSearch.create({
    data: { userId, query: trimmed },
  });

  const all = await prisma.recentSearch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (all.length > MAX_RECENT_SEARCHES) {
    const toDelete = all.slice(MAX_RECENT_SEARCHES);
    await prisma.recentSearch.deleteMany({
      where: { id: { in: toDelete.map((r) => r.id) } },
    });
  }
}
