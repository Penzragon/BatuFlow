import { prisma } from "@/lib/db";

interface PeriodFilter {
  dateFrom?: string;
  dateTo?: string;
  year?: number;
  month?: number;
}

interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  balance: number;
}

interface IncomeStatementSection {
  label: string;
  accounts: { code: string; name: string; amount: number }[];
  total: number;
}

interface BalanceSheetSection {
  label: string;
  accounts: { code: string; name: string; amount: number }[];
  total: number;
}

export class FinancialReportService {
  private static buildDateFilter(params: PeriodFilter) {
    if (params.dateFrom || params.dateTo) {
      return {
        ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
        ...(params.dateTo ? { lte: new Date(params.dateTo + "T23:59:59Z") } : {}),
      };
    }
    if (params.year && params.month) {
      const start = new Date(params.year, params.month - 1, 1);
      const end = new Date(params.year, params.month, 0, 23, 59, 59);
      return { gte: start, lte: end };
    }
    return undefined;
  }

  static async getTrialBalance(params: PeriodFilter): Promise<{
    rows: TrialBalanceRow[];
    totalDebit: number;
    totalCredit: number;
  }> {
    const dateFilter = FinancialReportService.buildDateFilter(params);

    const where: Record<string, unknown> = {
      journalEntry: { status: "POSTED" },
    };
    if (dateFilter) {
      where.journalEntry = { ...where.journalEntry as object, entryDate: dateFilter };
    }

    const lines = await prisma.journalLine.findMany({
      where,
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
      },
    });

    const accountMap = new Map<string, TrialBalanceRow>();

    for (const line of lines) {
      const key = line.accountId;
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          accountId: line.account.id,
          accountCode: line.account.code,
          accountName: line.account.name,
          accountType: line.account.type,
          debit: 0,
          credit: 0,
          balance: 0,
        });
      }
      const row = accountMap.get(key)!;
      row.debit += line.debit;
      row.credit += line.credit;
    }

    const rows = Array.from(accountMap.values())
      .map((r) => ({ ...r, balance: r.debit - r.credit }))
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    return {
      rows,
      totalDebit: rows.reduce((s, r) => s + r.debit, 0),
      totalCredit: rows.reduce((s, r) => s + r.credit, 0),
    };
  }

  static async getIncomeStatement(params: PeriodFilter): Promise<{
    revenue: IncomeStatementSection;
    cogs: IncomeStatementSection;
    grossProfit: number;
    expenses: IncomeStatementSection;
    netIncome: number;
  }> {
    const dateFilter = FinancialReportService.buildDateFilter(params);

    const where: Record<string, unknown> = {
      journalEntry: { status: "POSTED" },
      account: { type: { in: ["REVENUE", "COGS", "EXPENSE"] } },
    };
    if (dateFilter) {
      where.journalEntry = { ...where.journalEntry as object, entryDate: dateFilter };
    }

    const lines = await prisma.journalLine.findMany({
      where,
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
      },
    });

    const revenueAccounts: Record<string, { code: string; name: string; amount: number }> = {};
    const cogsAccounts: Record<string, { code: string; name: string; amount: number }> = {};
    const expenseAccounts: Record<string, { code: string; name: string; amount: number }> = {};

    for (const line of lines) {
      const net = line.credit - line.debit;
      const absNet = line.debit - line.credit;
      const key = line.accountId;

      if (line.account.type === "REVENUE") {
        if (!revenueAccounts[key]) revenueAccounts[key] = { code: line.account.code, name: line.account.name, amount: 0 };
        revenueAccounts[key].amount += net;
      } else if (line.account.type === "COGS") {
        if (!cogsAccounts[key]) cogsAccounts[key] = { code: line.account.code, name: line.account.name, amount: 0 };
        cogsAccounts[key].amount += absNet;
      } else if (line.account.type === "EXPENSE") {
        if (!expenseAccounts[key]) expenseAccounts[key] = { code: line.account.code, name: line.account.name, amount: 0 };
        expenseAccounts[key].amount += absNet;
      }
    }

    const revenue: IncomeStatementSection = {
      label: "Revenue",
      accounts: Object.values(revenueAccounts).sort((a, b) => a.code.localeCompare(b.code)),
      total: Object.values(revenueAccounts).reduce((s, a) => s + a.amount, 0),
    };

    const cogs: IncomeStatementSection = {
      label: "Cost of Goods Sold",
      accounts: Object.values(cogsAccounts).sort((a, b) => a.code.localeCompare(b.code)),
      total: Object.values(cogsAccounts).reduce((s, a) => s + a.amount, 0),
    };

    const grossProfit = revenue.total - cogs.total;

    const expenses: IncomeStatementSection = {
      label: "Operating Expenses",
      accounts: Object.values(expenseAccounts).sort((a, b) => a.code.localeCompare(b.code)),
      total: Object.values(expenseAccounts).reduce((s, a) => s + a.amount, 0),
    };

    return {
      revenue,
      cogs,
      grossProfit,
      expenses,
      netIncome: grossProfit - expenses.total,
    };
  }

  static async getBalanceSheet(params: PeriodFilter): Promise<{
    assets: BalanceSheetSection;
    liabilities: BalanceSheetSection;
    equity: BalanceSheetSection;
    totalAssets: number;
    totalLiabilitiesAndEquity: number;
  }> {
    const dateFilter = FinancialReportService.buildDateFilter(params);

    const where: Record<string, unknown> = {
      journalEntry: { status: "POSTED" },
      account: { type: { in: ["ASSET", "LIABILITY", "EQUITY"] } },
    };
    if (dateFilter) {
      where.journalEntry = { ...where.journalEntry as object, entryDate: dateFilter };
    }

    const lines = await prisma.journalLine.findMany({
      where,
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
      },
    });

    const assetAccounts: Record<string, { code: string; name: string; amount: number }> = {};
    const liabilityAccounts: Record<string, { code: string; name: string; amount: number }> = {};
    const equityAccounts: Record<string, { code: string; name: string; amount: number }> = {};

    for (const line of lines) {
      const key = line.accountId;

      if (line.account.type === "ASSET") {
        if (!assetAccounts[key]) assetAccounts[key] = { code: line.account.code, name: line.account.name, amount: 0 };
        assetAccounts[key].amount += line.debit - line.credit;
      } else if (line.account.type === "LIABILITY") {
        if (!liabilityAccounts[key]) liabilityAccounts[key] = { code: line.account.code, name: line.account.name, amount: 0 };
        liabilityAccounts[key].amount += line.credit - line.debit;
      } else if (line.account.type === "EQUITY") {
        if (!equityAccounts[key]) equityAccounts[key] = { code: line.account.code, name: line.account.name, amount: 0 };
        equityAccounts[key].amount += line.credit - line.debit;
      }
    }

    const retainedEarnings = await FinancialReportService.getRetainedEarnings(params);

    const assets: BalanceSheetSection = {
      label: "Assets",
      accounts: Object.values(assetAccounts).sort((a, b) => a.code.localeCompare(b.code)),
      total: Object.values(assetAccounts).reduce((s, a) => s + a.amount, 0),
    };

    const liabilities: BalanceSheetSection = {
      label: "Liabilities",
      accounts: Object.values(liabilityAccounts).sort((a, b) => a.code.localeCompare(b.code)),
      total: Object.values(liabilityAccounts).reduce((s, a) => s + a.amount, 0),
    };

    const equityAccountsList = Object.values(equityAccounts).sort((a, b) => a.code.localeCompare(b.code));
    if (retainedEarnings !== 0) {
      equityAccountsList.push({ code: "RE", name: "Retained Earnings (Current Period)", amount: retainedEarnings });
    }

    const equity: BalanceSheetSection = {
      label: "Equity",
      accounts: equityAccountsList,
      total: equityAccountsList.reduce((s, a) => s + a.amount, 0),
    };

    return {
      assets,
      liabilities,
      equity,
      totalAssets: assets.total,
      totalLiabilitiesAndEquity: liabilities.total + equity.total,
    };
  }

  private static async getRetainedEarnings(params: PeriodFilter): Promise<number> {
    const is = await FinancialReportService.getIncomeStatement(params);
    return is.netIncome;
  }

  static async getPpnSummary(params: PeriodFilter): Promise<{
    outputPpn: number;
    inputPpn: number;
    netPpn: number;
    details: { type: string; referenceType: string; referenceId: string; amount: number; date: Date }[];
  }> {
    const dateFilter = FinancialReportService.buildDateFilter(params);

    const ppnOutputAccount = await prisma.account.findFirst({ where: { code: "2300", deletedAt: null } });
    const ppnInputAccount = await prisma.account.findFirst({ where: { code: "1400", deletedAt: null } });

    let outputPpn = 0;
    let inputPpn = 0;
    const details: { type: string; referenceType: string; referenceId: string; amount: number; date: Date }[] = [];

    if (ppnOutputAccount) {
      const where: Record<string, unknown> = {
        accountId: ppnOutputAccount.id,
        journalEntry: { status: "POSTED" },
      };
      if (dateFilter) {
        where.journalEntry = { ...where.journalEntry as object, entryDate: dateFilter };
      }

      const outputLines = await prisma.journalLine.findMany({
        where,
        include: { journalEntry: { select: { referenceType: true, referenceId: true, entryDate: true } } },
      });

      for (const line of outputLines) {
        const amount = line.credit - line.debit;
        outputPpn += amount;
        details.push({
          type: "output",
          referenceType: line.journalEntry.referenceType ?? "",
          referenceId: line.journalEntry.referenceId ?? "",
          amount,
          date: line.journalEntry.entryDate,
        });
      }
    }

    if (ppnInputAccount) {
      const where: Record<string, unknown> = {
        accountId: ppnInputAccount.id,
        journalEntry: { status: "POSTED" },
      };
      if (dateFilter) {
        where.journalEntry = { ...where.journalEntry as object, entryDate: dateFilter };
      }

      const inputLines = await prisma.journalLine.findMany({
        where,
        include: { journalEntry: { select: { referenceType: true, referenceId: true, entryDate: true } } },
      });

      for (const line of inputLines) {
        const amount = line.debit - line.credit;
        inputPpn += amount;
        details.push({
          type: "input",
          referenceType: line.journalEntry.referenceType ?? "",
          referenceId: line.journalEntry.referenceId ?? "",
          amount,
          date: line.journalEntry.entryDate,
        });
      }
    }

    return {
      outputPpn,
      inputPpn,
      netPpn: outputPpn - inputPpn,
      details: details.sort((a, b) => b.date.getTime() - a.date.getTime()),
    };
  }
}
