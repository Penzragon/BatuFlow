/**
 * BatuFlow seed — demo data for all modules.
 * Run: npm run db:seed (or npx prisma db seed)
 * Requires: DATABASE_URL in .env
 */
/* eslint-disable @typescript-eslint/no-var-requires */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const bcrypt = require("bcryptjs");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run seed");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = "password123";

async function main() {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  console.log("Seeding users...");
  const [admin, manager, staff1, staff2, driver, whStaff] = await Promise.all([
    prisma.user.create({ data: { name: "Admin User", email: "admin@batuflow.com", passwordHash: hash, role: "ADMIN" } }),
    prisma.user.create({ data: { name: "Manager User", email: "manager@batuflow.com", passwordHash: hash, role: "MANAGER" } }),
    prisma.user.create({ data: { name: "Sales Staff One", email: "staff1@batuflow.com", passwordHash: hash, role: "STAFF" } }),
    prisma.user.create({ data: { name: "Sales Staff Two", email: "staff2@batuflow.com", passwordHash: hash, role: "STAFF" } }),
    prisma.user.create({ data: { name: "Driver User", email: "driver@batuflow.com", passwordHash: hash, role: "DRIVER" } }),
    prisma.user.create({ data: { name: "Warehouse Staff", email: "warehouse@batuflow.com", passwordHash: hash, role: "WAREHOUSE_STAFF" } }),
  ]);

  console.log("Seeding warehouses and locations...");
  const [wh1, wh2] = await Promise.all([
    prisma.warehouse.create({
      data: {
        name: "Main Warehouse",
        address: "Jl. Gudang No. 1, Malang",
        isDefault: true,
        locations: {
          create: [
            { name: "Zone A", zone: "A" },
            { name: "Zone B", zone: "B" },
            { name: "Zone C", zone: "C" },
          ],
        },
      },
      include: { locations: true },
    }),
    prisma.warehouse.create({
      data: {
        name: "Secondary Warehouse",
        address: "Jl. Raya Surabaya Km 5",
        locations: {
          create: [
            { name: "Area 1", zone: "1" },
            { name: "Area 2", zone: "2" },
          ],
        },
      },
      include: { locations: true },
    }),
  ]);

  console.log("Seeding products and price tiers...");
  const categories = ["Building Materials", "Tools", "Hardware", "Safety"];
  const products: { id: string; sku: string; name: string; category: string; sellPrice: number; capitalCost: number; minStock: number }[] = [];
  for (let i = 1; i <= 18; i++) {
    const cat = categories[(i - 1) % categories.length];
    const p = await prisma.product.create({
      data: {
        sku: `SKU-${String(i).padStart(4, "0")}`,
        name: `${cat} Product ${i}`,
        category: cat,
        brand: i % 2 === 0 ? "BrandA" : "BrandB",
        baseUom: "pcs",
        capitalCost: 50000 + i * 5000,
        sellPrice: 75000 + i * 6000,
        minStock: i <= 5 ? 10 : 0,
        maxStock: 500,
      },
    });
    products.push({ id: p.id, sku: p.sku, name: p.name, category: p.category!, sellPrice: p.sellPrice, capitalCost: p.capitalCost, minStock: p.minStock });
    await prisma.productPriceTier.createMany({
      data: [
        { productId: p.id, minQty: 1, maxQty: 9, unitPrice: p.sellPrice },
        { productId: p.id, minQty: 10, maxQty: 49, unitPrice: p.sellPrice * 0.98 },
        { productId: p.id, minQty: 50, maxQty: null, unitPrice: p.sellPrice * 0.95 },
      ],
    });
  }

  console.log("Seeding customers...");
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        name: "PT Maju Jaya",
        address: "Jl. Sudirman 100, Jakarta",
        phone: "021-5550001",
        email: "maju@example.com",
        paymentTermsDays: 30,
        salespersonId: staff1.id,
        region: "Jakarta",
        tier: "Gold",
        gpsLatitude: -6.2,
        gpsLongitude: 106.8,
        contacts: { create: [{ name: "Budi", phone: "08123450001", email: "budi@maju.com", position: "Purchasing", isPrimary: true }] },
      },
    }),
    prisma.customer.create({
      data: {
        name: "CV Sentosa",
        address: "Jl. Gatot Subroto 50, Surabaya",
        phone: "031-5550002",
        paymentTermsDays: 14,
        salespersonId: staff1.id,
        region: "Surabaya",
        contacts: { create: [{ name: "Siti", phone: "08123450002", position: "Admin", isPrimary: true }] },
      },
    }),
    prisma.customer.create({
      data: {
        name: "Toko Berkah",
        address: "Jl. Ahmad Yani 20, Malang",
        phone: "0341-5550003",
        paymentTermsDays: 7,
        salespersonId: staff2.id,
        region: "Malang",
      },
    }),
    ...Array.from({ length: 7 }, (_, i) =>
      prisma.customer.create({
        data: {
          name: `Customer ${i + 4}`,
          address: `Jl. Example ${i + 1}, City`,
          phone: `0812345000${i + 3}`,
          paymentTermsDays: 30,
          salespersonId: i % 2 === 0 ? staff1.id : staff2.id,
        },
      })
    ),
  ]);

  console.log("Seeding chart of accounts...");
  const assetAccount = await prisma.account.create({
    data: { code: "1", name: "Assets", type: "ASSET" },
  });
  const cashAccount = await prisma.account.create({
    data: { code: "1-1000", name: "Cash", type: "ASSET", parentId: assetAccount.id },
  });
  const arAccount = await prisma.account.create({
    data: { code: "1-1100", name: "Accounts Receivable", type: "ASSET", parentId: assetAccount.id },
  });
  const inventoryAccount = await prisma.account.create({
    data: { code: "1-1200", name: "Inventory", type: "ASSET", parentId: assetAccount.id },
  });
  const liabilityAccount = await prisma.account.create({
    data: { code: "2", name: "Liabilities", type: "LIABILITY" },
  });
  const equityAccount = await prisma.account.create({
    data: { code: "3", name: "Equity", type: "EQUITY" },
  });
  const revenueAccount = await prisma.account.create({
    data: { code: "4", name: "Revenue", type: "REVENUE" },
  });
  const cogsAccount = await prisma.account.create({
    data: { code: "5", name: "Cost of Goods Sold", type: "COGS" },
  });
  const expenseAccount = await prisma.account.create({
    data: { code: "6", name: "Operating Expenses", type: "EXPENSE" },
  });

  console.log("Seeding expense categories...");
  const expenseCategories = await Promise.all([
    prisma.expenseCategory.create({ data: { name: "Travel", coaAccountId: expenseAccount.id } }),
    prisma.expenseCategory.create({ data: { name: "Office Supplies", coaAccountId: expenseAccount.id } }),
    prisma.expenseCategory.create({ data: { name: "Utilities", coaAccountId: expenseAccount.id } }),
    prisma.expenseCategory.create({ data: { name: "Meals", coaAccountId: expenseAccount.id } }),
    prisma.expenseCategory.create({ data: { name: "Marketing", coaAccountId: expenseAccount.id } }),
    prisma.expenseCategory.create({ data: { name: "Other", coaAccountId: expenseAccount.id } }),
  ]);

  console.log("Seeding employees...");
  const now = new Date();
  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        userId: admin.id,
        name: "Admin User",
        nik: "NIK001",
        department: "Management",
        position: "Administrator",
        joinDate: new Date(now.getFullYear() - 2, 0, 1),
        basicSalary: 15000000,
        allowances: 2000000,
        deductions: 0,
        employmentType: "PERMANENT",
        email: admin.email,
        bankName: "BCA",
        bankAccount: "1234567890",
      },
    }),
    prisma.employee.create({
      data: {
        userId: manager.id,
        name: "Manager User",
        nik: "NIK002",
        department: "Sales",
        position: "Sales Manager",
        joinDate: new Date(now.getFullYear() - 1, 6, 1),
        basicSalary: 12000000,
        allowances: 1500000,
        deductions: 0,
        employmentType: "PERMANENT",
        email: manager.email,
      },
    }),
    prisma.employee.create({
      data: {
        userId: staff1.id,
        name: "Sales Staff One",
        nik: "NIK003",
        department: "Sales",
        position: "Salesperson",
        joinDate: new Date(now.getFullYear(), 0, 15),
        basicSalary: 8000000,
        allowances: 500000,
        deductions: 0,
        employmentType: "PERMANENT",
        email: staff1.email,
      },
    }),
    prisma.employee.create({
      data: {
        userId: staff2.id,
        name: "Sales Staff Two",
        nik: "NIK004",
        department: "Sales",
        position: "Salesperson",
        joinDate: new Date(now.getFullYear(), 1, 1),
        basicSalary: 8000000,
        allowances: 500000,
        deductions: 0,
        employmentType: "PERMANENT",
        email: staff2.email,
      },
    }),
    prisma.employee.create({
      data: {
        userId: driver.id,
        name: "Driver User",
        nik: "NIK005",
        department: "Logistics",
        position: "Driver",
        joinDate: new Date(now.getFullYear(), 2, 1),
        basicSalary: 6000000,
        allowances: 300000,
        deductions: 0,
        employmentType: "PERMANENT",
        email: driver.email,
      },
    }),
    prisma.employee.create({
      data: {
        userId: whStaff.id,
        name: "Warehouse Staff",
        nik: "NIK006",
        department: "Warehouse",
        position: "Warehouse Staff",
        joinDate: new Date(now.getFullYear(), 1, 15),
        basicSalary: 5500000,
        allowances: 250000,
        deductions: 0,
        employmentType: "PERMANENT",
        email: whStaff.email,
      },
    }),
  ]);

  console.log("Seeding fiscal period...");
  await prisma.fiscalPeriod.create({
    data: { year: now.getFullYear(), month: now.getMonth() + 1, status: "OPEN" },
  });

  console.log("Seeding stock (goods receipt + ledger)...");
  const gr = await prisma.goodsReceipt.create({
    data: {
      receiptNumber: `GR-${now.getFullYear()}-00001`,
      supplierName: "Supplier Demo",
      warehouseId: wh1.id,
      receiptDate: new Date(),
      status: "CONFIRMED",
      verifiedBy: manager.id,
      verifiedAt: new Date(),
      confirmedBy: manager.id,
      confirmedAt: new Date(),
      createdBy: whStaff.id,
      lines: {
        create: products.slice(0, 10).map((p) => ({
          productId: p.id,
          expectedQty: 100,
          receivedQty: 100,
          condition: "GOOD",
          newCost: p.capitalCost,
        })),
      },
    },
    include: { lines: true },
  });

  for (const line of gr.lines) {
    await prisma.stockLedger.create({
      data: {
        productId: line.productId,
        warehouseId: wh1.id,
        movementType: "STOCK_IN",
        qty: line.receivedQty,
        referenceType: "GoodsReceipt",
        referenceId: gr.id,
        createdBy: whStaff.id,
      },
    });
  }

  console.log("Seeding sales orders and delivery flow...");
  const so1Subtotal = products[0].sellPrice * 20 + products[1].sellPrice * 15;
  const so1Ppn = so1Subtotal * 0.11;
  const so1 = await prisma.salesOrder.create({
    data: {
      soNumber: `SO-${now.getFullYear()}-00001`,
      customerId: customers[0].id,
      status: "CONFIRMED",
      subtotal: so1Subtotal,
      discountTotal: 0,
      ppnRate: 0.11,
      ppnAmount: so1Ppn,
      grandTotal: so1Subtotal + so1Ppn,
      createdBy: staff1.id,
      lines: {
        create: [
          { productId: products[0].id, productName: products[0].name, productSku: products[0].sku, qty: 20, unitPrice: products[0].sellPrice, lineTotal: products[0].sellPrice * 20 },
          { productId: products[1].id, productName: products[1].name, productSku: products[1].sku, qty: 15, unitPrice: products[1].sellPrice, lineTotal: products[1].sellPrice * 15 },
        ],
      },
    },
    include: { lines: true },
  });

  const do1 = await prisma.deliveryOrder.create({
    data: {
      doNumber: `DO-${now.getFullYear()}-00001`,
      salesOrderId: so1.id,
      status: "CONFIRMED",
      confirmedAt: new Date(),
      createdBy: staff1.id,
      lines: {
        create: [
          { productId: products[0].id, productName: products[0].name, productSku: products[0].sku, qtyOrdered: 20, qtyDelivered: 20 },
          { productId: products[1].id, productName: products[1].name, productSku: products[1].sku, qtyOrdered: 15, qtyDelivered: 15 },
        ],
      },
    },
    include: { lines: true },
  });

  for (const line of do1.lines) {
    await prisma.stockLedger.create({
      data: {
        productId: line.productId,
        warehouseId: wh1.id,
        movementType: "STOCK_OUT",
        qty: line.qtyDelivered,
        referenceType: "DeliveryOrder",
        referenceId: do1.id,
        createdBy: staff1.id,
      },
    });
  }

  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + customers[0].paymentTermsDays);
  const inv1Grand = so1Subtotal + so1Ppn;
  const inv1 = await prisma.arInvoice.create({
    data: {
      invoiceNumber: `INV-${now.getFullYear()}-00001`,
      doId: do1.id,
      customerId: customers[0].id,
      status: "PAID",
      subtotal: so1Subtotal,
      ppnAmount: so1Ppn,
      grandTotal: inv1Grand,
      amountPaid: inv1Grand,
      dueDate,
      issuedAt: new Date(),
      createdBy: staff1.id,
    },
  });

  await prisma.payment.create({
    data: {
      invoiceId: inv1.id,
      amount: inv1Grand,
      method: "TRANSFER",
      reference: "PAY-001",
      paymentDate: new Date(),
      createdBy: admin.id,
    },
  });

  console.log("Seeding expense and leave request...");
  await prisma.expense.create({
    data: {
      expenseNumber: `EXP-${now.getFullYear()}-00001`,
      categoryId: expenseCategories[0].id,
      amount: 500000,
      description: "Client visit travel",
      expenseDate: new Date(),
      status: "SUBMITTED",
      submittedBy: staff1.id,
    },
  });

  const empStaff1 = employees.find((e) => e.userId === staff1.id)!;
  await prisma.leaveRequest.create({
    data: {
      employeeId: empStaff1.id,
      leaveType: "ANNUAL",
      startDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 3),
      days: 3,
      reason: "Family trip",
      status: "PENDING",
    },
  });

  console.log("Seeding vehicles and trip...");
  const vehicle = await prisma.vehicle.create({
    data: { plateNumber: "B 1234 XYZ", vehicleType: "VAN", status: "AVAILABLE" },
  });

  const tripDate = new Date(now);
  tripDate.setHours(0, 0, 0, 0);
  await prisma.trip.create({
    data: {
      tripNumber: `TRIP-${now.getFullYear()}-00001`,
      driverId: driver.id,
      vehicleId: vehicle.id,
      status: "PLANNED",
      tripDate,
      createdBy: manager.id,
    },
  });

  console.log("Seeding leads and sales target...");
  await prisma.lead.create({
    data: {
      name: "Prospect Alpha",
      company: "PT Alpha",
      phone: "0819990001",
      email: "alpha@example.com",
      status: "CONTACTED",
      assignedTo: staff1.id,
      value: 50000000,
    },
  });

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  await prisma.salesTarget.create({
    data: {
      salespersonId: staff1.id,
      periodMonth: currentMonth,
      periodYear: currentYear,
      targetAmount: 100000000,
    },
  });
  await prisma.salesTarget.create({
    data: {
      salespersonId: staff2.id,
      periodMonth: currentMonth,
      periodYear: currentYear,
      targetAmount: 80000000,
    },
  });

  console.log("Seeding pick list for DO...");
  const pickList = await prisma.pickList.create({
    data: {
      pickListNumber: `PL-${now.getFullYear()}-00001`,
      deliveryOrderId: do1.id,
      status: "PACKED",
      createdBy: whStaff.id,
      lines: {
        create: do1.lines.map((l: { productId: string; productName: string; productSku: string; qtyDelivered: number }) => ({
          productId: l.productId,
          productName: l.productName,
          productSku: l.productSku,
          qtyRequired: l.qtyDelivered,
          qtyPicked: l.qtyDelivered,
        })),
      },
    },
  });

  console.log("Seeding second goods receipt (DRAFT)...");
  await prisma.goodsReceipt.create({
    data: {
      receiptNumber: `GR-${now.getFullYear()}-00002`,
      supplierName: "Supplier Two",
      warehouseId: wh1.id,
      receiptDate: new Date(),
      status: "DRAFT",
      createdBy: whStaff.id,
      lines: {
        create: products.slice(10, 13).map((p) => ({
          productId: p.id,
          expectedQty: 50,
          receivedQty: 0,
          condition: "GOOD",
        })),
      },
    },
  });

  console.log("Seed completed.");
  console.log("Login with: admin@batuflow.com / password123 (and manager@, staff1@, driver@, warehouse@...)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
