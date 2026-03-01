import { prisma } from "@/lib/db";
import { AuditService } from "@/services/audit.service";
import type { PaginationParams, PaginatedResponse } from "@/types";
import type { Customer, CustomerContact } from "@prisma/client";

interface CustomerWithContacts extends Customer {
  contacts: CustomerContact[];
}

interface ListCustomersParams extends PaginationParams {
  region?: string;
  tier?: string;
  isActive?: boolean;
}

interface CreateCustomerData {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  paymentTermsDays?: number;
  salespersonId?: string;
  region?: string;
  tier?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  isActive?: boolean;
}

interface UpdateCustomerData extends Partial<CreateCustomerData> {}

interface ContactData {
  name: string;
  phone?: string;
  email?: string;
  position?: string;
  isPrimary?: boolean;
}

/**
 * Service layer for Customer CRUD operations with audit logging.
 * Handles all business logic for customer management including
 * contacts, pagination, search, and soft delete.
 */
export class CustomerService {
  /**
   * Returns a paginated list of customers with optional search and filters.
   * Searches across name, phone, and email fields. Excludes soft-deleted records.
   */
  static async listCustomers(
    params: ListCustomersParams
  ): Promise<PaginatedResponse<Customer>> {
    const { page, pageSize, sortBy, sortOrder, search, region, tier, isActive } =
      params;

    const where: Record<string, unknown> = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (region) {
      where.region = { contains: region, mode: "insensitive" };
    }

    if (tier) {
      where.tier = tier;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const orderBy = sortBy
      ? { [sortBy]: sortOrder ?? "desc" }
      : { createdAt: sortOrder ?? "desc" as const };

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Retrieves a single customer by ID, including all contacts.
   * Throws if the customer does not exist or has been soft-deleted.
   */
  static async getCustomer(id: string): Promise<CustomerWithContacts> {
    const customer = await prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: { contacts: { orderBy: { isPrimary: "desc" } } },
    });

    if (!customer) {
      const err = new Error("Customer not found");
      (err as Error & { status: number }).status = 404;
      throw err;
    }

    return customer;
  }

  /**
   * Creates a new customer and logs the creation in the audit trail.
   * Returns the newly created customer with empty contacts array.
   */
  static async createCustomer(
    data: CreateCustomerData,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<CustomerWithContacts> {
    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email || null,
        taxId: data.taxId,
        paymentTermsDays: data.paymentTermsDays ?? 30,
        salespersonId: data.salespersonId,
        region: data.region,
        tier: data.tier,
        gpsLatitude: data.gpsLatitude,
        gpsLongitude: data.gpsLongitude,
        isActive: data.isActive ?? true,
      },
      include: { contacts: true },
    });

    await AuditService.logCreate({
      userId,
      userRole,
      ipAddress,
      entityType: "Customer",
      entityId: customer.id,
      entityLabel: customer.name,
      data: customer as unknown as Record<string, unknown>,
    });

    return customer;
  }

  /**
   * Updates an existing customer and logs field-level changes in the audit trail.
   * Returns the updated customer with contacts.
   */
  static async updateCustomer(
    id: string,
    data: UpdateCustomerData,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<CustomerWithContacts> {
    const existing = await prisma.customer.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      const err = new Error("Customer not found");
      (err as Error & { status: number }).status = 404;
      throw err;
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email === "" ? null : data.email,
        taxId: data.taxId,
        paymentTermsDays: data.paymentTermsDays,
        salespersonId: data.salespersonId,
        region: data.region,
        tier: data.tier,
        gpsLatitude: data.gpsLatitude,
        gpsLongitude: data.gpsLongitude,
        isActive: data.isActive,
      },
      include: { contacts: true },
    });

    await AuditService.logUpdate({
      userId,
      userRole,
      ipAddress,
      entityType: "Customer",
      entityId: id,
      entityLabel: updated.name,
      oldData: existing as unknown as Record<string, unknown>,
      newData: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  /**
   * Soft-deletes a customer by setting deletedAt timestamp.
   * Logs the deletion in the audit trail with a full snapshot.
   */
  static async deleteCustomer(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<void> {
    const existing = await prisma.customer.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      const err = new Error("Customer not found");
      (err as Error & { status: number }).status = 404;
      throw err;
    }

    await prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await AuditService.logDelete({
      userId,
      userRole,
      ipAddress,
      entityType: "Customer",
      entityId: id,
      entityLabel: existing.name,
      data: existing as unknown as Record<string, unknown>,
    });
  }

  /**
   * Adds a contact person to a customer. Validates the customer exists first.
   */
  static async addContact(
    customerId: string,
    data: ContactData
  ): Promise<CustomerContact> {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });

    if (!customer) {
      const err = new Error("Customer not found");
      (err as Error & { status: number }).status = 404;
      throw err;
    }

    return prisma.customerContact.create({
      data: {
        customerId,
        name: data.name,
        phone: data.phone,
        email: data.email,
        position: data.position,
        isPrimary: data.isPrimary ?? false,
      },
    });
  }

  /**
   * Updates an existing contact person's details.
   */
  static async updateContact(
    contactId: string,
    data: ContactData
  ): Promise<CustomerContact> {
    const existing = await prisma.customerContact.findUnique({
      where: { id: contactId },
    });

    if (!existing) {
      const err = new Error("Contact not found");
      (err as Error & { status: number }).status = 404;
      throw err;
    }

    return prisma.customerContact.update({
      where: { id: contactId },
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        position: data.position,
        isPrimary: data.isPrimary,
      },
    });
  }

  /**
   * Removes a contact person from a customer by deleting the record.
   */
  static async removeContact(contactId: string): Promise<void> {
    const existing = await prisma.customerContact.findUnique({
      where: { id: contactId },
    });

    if (!existing) {
      const err = new Error("Contact not found");
      (err as Error & { status: number }).status = 404;
      throw err;
    }

    await prisma.customerContact.delete({ where: { id: contactId } });
  }
}
