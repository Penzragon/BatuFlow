import * as XLSX from "xlsx";
import { AccountType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AuditService } from "@/services/audit.service";
import type { ImportValidationError, ImportValidationResult } from "@/types";

const MAX_ROWS = 5000;
const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "COGS", "EXPENSE"] as const;

export type ImportType = "products" | "customers" | "accounts" | "employees";

/** Template metadata for each import type */
const TEMPLATES: Record<
  ImportType,
  {
    dataHeaders: string[];
    exampleRow: Record<string, string | number>;
    fieldDescriptions: [string, string, string][];
  }
> = {
  products: {
    dataHeaders: [
      "SKU",
      "Name",
      "UOM",
      "Sell Price",
      "Category",
      "Brand",
      "Capital Cost",
      "Min Stock",
    ],
    exampleRow: {
      SKU: "SKU-001",
      Name: "Example Product",
      UOM: "pcs",
      "Sell Price": 100000,
      Category: "Category A",
      Brand: "Brand X",
      "Capital Cost": 75000,
      "Min Stock": 10,
    },
    fieldDescriptions: [
      ["SKU", "Yes", "Unique product code"],
      ["Name", "Yes", "Product name"],
      ["UOM", "Yes", "Unit of measure (e.g. pcs, box, kg)"],
      ["Sell Price", "Yes", "Selling price (number)"],
      ["Category", "No", "Product category"],
      ["Brand", "No", "Brand name"],
      ["Capital Cost", "No", "Capital/cost price (number), default 0"],
      ["Min Stock", "No", "Minimum stock level (number), default 0"],
    ],
  },
  customers: {
    dataHeaders: [
      "Name",
      "Phone",
      "Address",
      "Tax ID",
      "Payment Terms (days)",
      "Salesperson ID",
      "GPS Lat",
      "GPS Lng",
    ],
    exampleRow: {
      Name: "Example Customer",
      Phone: "+62123456789",
      Address: "123 Main St",
      "Tax ID": "12.345.678.9-012.000",
      "Payment Terms (days)": 30,
      "Salesperson ID": "",
      "GPS Lat": -6.2,
      "GPS Lng": 106.8,
    },
    fieldDescriptions: [
      ["Name", "Yes", "Customer name"],
      ["Phone", "Yes", "Phone number"],
      ["Address", "No", "Full address"],
      ["Tax ID", "No", "Tax identification number"],
      ["Payment Terms (days)", "No", "Payment terms in days (number), default 30"],
      ["Salesperson ID", "No", "Employee ID of assigned salesperson"],
      ["GPS Lat", "No", "Latitude for location"],
      ["GPS Lng", "No", "Longitude for location"],
    ],
  },
  accounts: {
    dataHeaders: ["Code", "Name", "Type"],
    exampleRow: {
      Code: "1000",
      Name: "Cash",
      Type: "ASSET",
    },
    fieldDescriptions: [
      ["Code", "Yes", "Unique account code"],
      ["Name", "Yes", "Account name"],
      ["Type", "Yes", "One of: ASSET, LIABILITY, EQUITY, REVENUE, COGS, EXPENSE"],
    ],
  },
  employees: {
    dataHeaders: ["Name", "NIK", "Department", "Position"],
    exampleRow: {
      Name: "John Doe",
      NIK: "EMP001",
      Department: "Sales",
      Position: "Sales Representative",
    },
    fieldDescriptions: [
      ["Name", "Yes", "Employee full name"],
      ["NIK", "Yes", "Unique employee ID / National ID"],
      ["Department", "Yes", "Department name"],
      ["Position", "Yes", "Job position/title"],
    ],
  },
};

/**
 * Generates an Excel template for the given import type.
 * Sheet 1 contains headers and example row; Sheet 2 contains field descriptions.
 *
 * @param type - One of "products", "customers", "accounts", "employees"
 * @returns Buffer containing the Excel file
 */
export function generateTemplate(type: string): Buffer {
  const normalized = type.toLowerCase() as ImportType;
  const template = TEMPLATES[normalized];
  if (!template) {
    throw new Error(`Invalid import type: ${type}`);
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Data with headers and example row
  const dataRows = [
    template.dataHeaders,
    template.dataHeaders.map((h) => template.exampleRow[h] ?? ""),
  ];
  const dataSheet = XLSX.utils.aoa_to_sheet(dataRows);
  XLSX.utils.book_append_sheet(wb, dataSheet, "Data");

  // Sheet 2: Field descriptions
  const descRows = [
    ["Field", "Required", "Description"],
    ...template.fieldDescriptions,
  ];
  const descSheet = XLSX.utils.aoa_to_sheet(descRows);
  XLSX.utils.book_append_sheet(wb, descSheet, "Field Descriptions");

  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

/**
 * Parses an Excel file buffer into an array of row objects.
 * Uses the first row as headers and maps to keys.
 *
 * @param buffer - Excel file buffer
 * @returns Array of row objects
 */
export function parseExcelFile(buffer: Buffer): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: "",
    raw: false,
  });
  // Normalize keys: trim and handle empty
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      const key = String(k || "").trim();
      if (key) {
        out[key] = v === "" || v === null || v === undefined ? "" : v;
      }
    }
    return out;
  });
}

/**
 * Validates imported rows for the given type.
 * Checks required fields, data types, duplicates, and max row count.
 *
 * @param type - One of "products", "customers", "accounts", "employees"
 * @param data - Array of row objects from parsed Excel
 * @returns Validation result with validRows, errors, and totalRows
 */
export async function validateImport(
  type: string,
  data: Record<string, unknown>[]
): Promise<ImportValidationResult> {
  const normalized = type.toLowerCase() as ImportType;
  const template = TEMPLATES[normalized];
  if (!template) {
    return {
      validRows: [],
      errors: [{ row: 0, field: "type", message: `Invalid import type: ${type}` }],
      totalRows: 0,
    };
  }

  const errors: ImportValidationError[] = [];
  const validRows: Record<string, unknown>[] = [];
  const totalRows = data.length;

  if (totalRows > MAX_ROWS) {
    errors.push({
      row: 0,
      field: "_",
      message: `Maximum ${MAX_ROWS} rows allowed per upload. Found ${totalRows}.`,
    });
    return { validRows: [], errors, totalRows };
  }

  const seenKeys = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2; // 1-based + header row
    const rowErrors: ImportValidationError[] = [];

    if (normalized === "products") {
      validateProductRow(row, rowNum, rowErrors, seenKeys);
    } else if (normalized === "customers") {
      validateCustomerRow(row, rowNum, rowErrors);
    } else if (normalized === "accounts") {
      validateAccountRow(row, rowNum, rowErrors, seenKeys);
    } else if (normalized === "employees") {
      validateEmployeeRow(row, rowNum, rowErrors, seenKeys);
    }

    if (rowErrors.length === 0) {
      validRows.push(normalizeRowForType(normalized, row));
    } else {
      errors.push(...rowErrors);
    }
  }

  return { validRows, errors, totalRows };
}

function validateProductRow(
  row: Record<string, unknown>,
  rowNum: number,
  errors: ImportValidationError[],
  seenKeys: Set<string>
) {
  const sku = String(row["SKU"] ?? "").trim();
  const name = String(row["Name"] ?? "").trim();
  const uom = String(row["UOM"] ?? "").trim();
  const sellPrice = row["Sell Price"];

  if (!sku) errors.push({ row: rowNum, field: "SKU", message: "Required", value: String(row["SKU"]) });
  if (!name) errors.push({ row: rowNum, field: "Name", message: "Required", value: String(row["Name"]) });
  if (!uom) errors.push({ row: rowNum, field: "UOM", message: "Required", value: String(row["UOM"]) });

  const priceNum = parseFloat(String(sellPrice ?? ""));
  if (isNaN(priceNum) || priceNum < 0) {
    errors.push({
      row: rowNum,
      field: "Sell Price",
      message: "Must be a valid non-negative number",
      value: String(sellPrice),
    });
  }

  if (sku && seenKeys.has(`product:${sku}`)) {
    errors.push({ row: rowNum, field: "SKU", message: "Duplicate SKU in file", value: sku });
  }
  if (sku) seenKeys.add(`product:${sku}`);
}

function validateCustomerRow(
  row: Record<string, unknown>,
  rowNum: number,
  errors: ImportValidationError[]
) {
  const name = String(row["Name"] ?? "").trim();
  const phone = String(row["Phone"] ?? "").trim();

  if (!name) errors.push({ row: rowNum, field: "Name", message: "Required", value: String(row["Name"]) });
  if (!phone) errors.push({ row: rowNum, field: "Phone", message: "Required", value: String(row["Phone"]) });
}

function validateAccountRow(
  row: Record<string, unknown>,
  rowNum: number,
  errors: ImportValidationError[],
  seenKeys: Set<string>
) {
  const code = String(row["Code"] ?? "").trim();
  const name = String(row["Name"] ?? "").trim();
  const typeVal = String(row["Type"] ?? "").trim().toUpperCase();

  if (!code) errors.push({ row: rowNum, field: "Code", message: "Required", value: String(row["Code"]) });
  if (!name) errors.push({ row: rowNum, field: "Name", message: "Required", value: String(row["Name"]) });
  if (!typeVal) {
    errors.push({ row: rowNum, field: "Type", message: "Required", value: String(row["Type"]) });
  } else if (!ACCOUNT_TYPES.includes(typeVal as (typeof ACCOUNT_TYPES)[number])) {
    errors.push({
      row: rowNum,
      field: "Type",
      message: `Must be one of: ${ACCOUNT_TYPES.join(", ")}`,
      value: typeVal,
    });
  }

  if (code && seenKeys.has(`account:${code}`)) {
    errors.push({ row: rowNum, field: "Code", message: "Duplicate account code in file", value: code });
  }
  if (code) seenKeys.add(`account:${code}`);
}

function validateEmployeeRow(
  row: Record<string, unknown>,
  rowNum: number,
  errors: ImportValidationError[],
  seenKeys: Set<string>
) {
  const name = String(row["Name"] ?? "").trim();
  const nik = String(row["NIK"] ?? "").trim();
  const department = String(row["Department"] ?? "").trim();
  const position = String(row["Position"] ?? "").trim();

  if (!name) errors.push({ row: rowNum, field: "Name", message: "Required", value: String(row["Name"]) });
  if (!nik) errors.push({ row: rowNum, field: "NIK", message: "Required", value: String(row["NIK"]) });
  if (!department) errors.push({ row: rowNum, field: "Department", message: "Required", value: String(row["Department"]) });
  if (!position) errors.push({ row: rowNum, field: "Position", message: "Required", value: String(row["Position"]) });

  if (nik && seenKeys.has(`employee:${nik}`)) {
    errors.push({ row: rowNum, field: "NIK", message: "Duplicate NIK in file", value: nik });
  }
  if (nik) seenKeys.add(`employee:${nik}`);
}

function normalizeRowForType(
  type: ImportType,
  row: Record<string, unknown>
): Record<string, unknown> {
  if (type === "products") {
    return {
      sku: String(row["SKU"] ?? "").trim(),
      name: String(row["Name"] ?? "").trim(),
      baseUom: String(row["UOM"] ?? "pcs").trim() || "pcs",
      sellPrice: parseFloat(String(row["Sell Price"] ?? "0")) || 0,
      category: String(row["Category"] ?? "").trim() || null,
      brand: String(row["Brand"] ?? "").trim() || null,
      capitalCost: parseFloat(String(row["Capital Cost"] ?? "0")) || 0,
      minStock: parseInt(String(row["Min Stock"] ?? "0"), 10) || 0,
    };
  }
  if (type === "customers") {
    return {
      name: String(row["Name"] ?? "").trim(),
      phone: String(row["Phone"] ?? "").trim(),
      address: String(row["Address"] ?? "").trim() || null,
      taxId: String(row["Tax ID"] ?? "").trim() || null,
      paymentTermsDays: parseInt(String(row["Payment Terms (days)"] ?? "30"), 10) || 30,
      salespersonId: String(row["Salesperson ID"] ?? "").trim() || null,
      gpsLatitude: parseFloat(String(row["GPS Lat"] ?? "")) || null,
      gpsLongitude: parseFloat(String(row["GPS Lng"] ?? "")) || null,
    };
  }
  if (type === "accounts") {
    return {
      code: String(row["Code"] ?? "").trim(),
      name: String(row["Name"] ?? "").trim(),
      type: String(row["Type"] ?? "").trim().toUpperCase() as AccountType,
    };
  }
  if (type === "employees") {
    return {
      name: String(row["Name"] ?? "").trim(),
      nik: String(row["NIK"] ?? "").trim(),
      department: String(row["Department"] ?? "").trim(),
      position: String(row["Position"] ?? "").trim(),
    };
  }
  return row;
}

/**
 * Executes the import transactionally.
 * Creates records in the database, logs the import, and writes audit entries.
 *
 * @param type - One of "products", "customers", "accounts", "employees"
 * @param validRows - Pre-validated row data
 * @param userId - ID of user performing the import
 * @param userRole - Role of the user
 * @param ipAddress - Optional client IP for audit
 * @param fileName - Original file name for ImportLog
 * @returns Import log record with success/error counts
 */
export async function executeImport(
  type: string,
  validRows: Record<string, unknown>[],
  userId: string,
  userRole: string,
  ipAddress?: string,
  fileName?: string
): Promise<{ successRows: number; errorRows: number; errors: unknown }> {
  const normalized = type.toLowerCase() as ImportType;
  const template = TEMPLATES[normalized];
  if (!template) {
    throw new Error(`Invalid import type: ${type}`);
  }

  const totalRows = validRows.length;
  let successRows = 0;
  const importErrors: { row: number; message: string }[] = [];

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        if (normalized === "products") {
          await createProduct(tx, row);
        } else if (normalized === "customers") {
          await createCustomer(tx, row);
        } else if (normalized === "accounts") {
          await createAccount(tx, row);
        } else if (normalized === "employees") {
          await createEmployee(tx, row);
        }
        successRows++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        importErrors.push({ row: i + 2, message: msg });
      }
    }

    await tx.importLog.create({
      data: {
        importType: normalized,
        fileName: fileName ?? "upload.xlsx",
        totalRows,
        successRows,
        errorRows: totalRows - successRows,
        errors: importErrors.length > 0 ? (importErrors as any) : undefined,
        importedBy: userId,
      },
    });
  });

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    const err = importErrors.find((e) => e.row === i + 2);
    if (err) continue;

    try {
      if (normalized === "products") {
        const created = await prisma.product.findFirst({
          where: { sku: row.sku as string },
          orderBy: { createdAt: "desc" },
        });
        if (created) {
          await AuditService.logCreate({
            userId,
            userRole,
            ipAddress,
            entityType: "Product",
            entityId: created.id,
            entityLabel: created.name,
            data: row as Record<string, unknown>,
            metadata: { source: "import" },
          });
        }
      } else if (normalized === "customers") {
        const created = await prisma.customer.findFirst({
          where: { name: row.name as string, phone: row.phone as string },
          orderBy: { createdAt: "desc" },
        });
        if (created) {
          await AuditService.logCreate({
            userId,
            userRole,
            ipAddress,
            entityType: "Customer",
            entityId: created.id,
            entityLabel: created.name,
            data: row as Record<string, unknown>,
            metadata: { source: "import" },
          });
        }
      } else if (normalized === "accounts") {
        const created = await prisma.account.findFirst({
          where: { code: row.code as string },
          orderBy: { createdAt: "desc" },
        });
        if (created) {
          await AuditService.logCreate({
            userId,
            userRole,
            ipAddress,
            entityType: "Account",
            entityId: created.id,
            entityLabel: created.name,
            data: row as Record<string, unknown>,
            metadata: { source: "import" },
          });
        }
      } else if (normalized === "employees") {
        const created = await prisma.employee.findFirst({
          where: { nik: row.nik as string },
          orderBy: { createdAt: "desc" },
        });
        if (created) {
          await AuditService.logCreate({
            userId,
            userRole,
            ipAddress,
            entityType: "Employee",
            entityId: created.id,
            entityLabel: created.name,
            data: row as Record<string, unknown>,
            metadata: { source: "import" },
          });
        }
      }
    } catch {
      // Audit is best-effort; don't fail import
    }
  }

  return {
    successRows,
    errorRows: totalRows - successRows,
    errors: importErrors.length > 0 ? importErrors : undefined,
  };
}

type PrismaTx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

async function createProduct(tx: PrismaTx, row: Record<string, unknown>) {
  const existing = await tx.product.findUnique({
    where: { sku: row.sku as string },
  });
  if (existing) {
    throw new Error(`SKU "${row.sku}" already exists`);
  }
  await tx.product.create({
    data: {
      sku: row.sku as string,
      name: row.name as string,
      baseUom: (row.baseUom as string) || "pcs",
      sellPrice: (row.sellPrice as number) ?? 0,
      category: (row.category as string) || null,
      brand: (row.brand as string) || null,
      capitalCost: (row.capitalCost as number) ?? 0,
      minStock: (row.minStock as number) ?? 0,
    },
  });
}

async function createCustomer(tx: PrismaTx, row: Record<string, unknown>) {
  await tx.customer.create({
    data: {
      name: row.name as string,
      phone: (row.phone as string) || null,
      address: (row.address as string) || null,
      taxId: (row.taxId as string) || null,
      paymentTermsDays: (row.paymentTermsDays as number) ?? 30,
      salespersonId: (row.salespersonId as string) || null,
      gpsLatitude: (row.gpsLatitude as number) ?? null,
      gpsLongitude: (row.gpsLongitude as number) ?? null,
    },
  });
}

async function createAccount(tx: PrismaTx, row: Record<string, unknown>) {
  const existing = await tx.account.findUnique({
    where: { code: row.code as string },
  });
  if (existing) {
    throw new Error(`Account code "${row.code}" already exists`);
  }
  await tx.account.create({
    data: {
      code: row.code as string,
      name: row.name as string,
      type: row.type as AccountType,
    },
  });
}

async function createEmployee(tx: PrismaTx, row: Record<string, unknown>) {
  const existing = await tx.employee.findUnique({
    where: { nik: row.nik as string },
  });
  if (existing) {
    throw new Error(`NIK "${row.nik}" already exists`);
  }
  await tx.employee.create({
    data: {
      name: row.name as string,
      nik: row.nik as string,
      department: (row.department as string) || null,
      position: (row.position as string) || null,
    },
  });
}

/**
 * Fetches recent import history for display.
 *
 * @param limit - Maximum number of records to return
 * @returns List of import logs with user info
 */
export async function getImportHistory(limit = 20) {
  return prisma.importLog.findMany({
    orderBy: { importedAt: "desc" },
    take: limit,
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}
