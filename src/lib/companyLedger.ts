import { getDb, initDb, scheduleBlobPersist } from "./db";
import crypto from "crypto";

export {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  type CompanyLedgerEntry,
  type CompanyLedgerSummary,
} from "./ledgerCategories";
import type { CompanyLedgerEntry, CompanyLedgerSummary } from "./ledgerCategories";

export async function getCompanyLedger(
  companyIdOrTicker: string
): Promise<{
  success: boolean;
  company?: { id: string; ticker: string; name: string; logoUrl: string; creatorId: string; description: string };
  entries: CompanyLedgerEntry[];
  summary: CompanyLedgerSummary;
  message?: string;
}> {
  await initDb();
  const db = getDb();

  // Find company by ID or Ticker
  const compRes = await db.execute({
    sql: "SELECT id, ticker, name, logo_url, creator_id, description FROM companies WHERE id = ? OR UPPER(ticker) = UPPER(?) LIMIT 1",
    args: [companyIdOrTicker, companyIdOrTicker],
  });

  if (compRes.rows.length === 0) {
    return {
      success: false,
      message: "Company not found.",
      entries: [],
      summary: { totalIncome: 0, totalExpense: 0, netProfit: 0, profitMargin: 0, entriesCount: 0 },
    };
  }

  const rawComp = compRes.rows[0];
  const company = {
    id: String(rawComp.id),
    ticker: String(rawComp.ticker),
    name: String(rawComp.name),
    logoUrl: String(rawComp.logo_url || "🏛️"),
    creatorId: String(rawComp.creator_id),
    description: String(rawComp.description || ""),
  };

  const res = await db.execute({
    sql: `SELECT cl.*, u.username, u.display_name, u.parlamentum_name 
          FROM company_ledger cl 
          LEFT JOIN users u ON cl.user_id = u.id 
          WHERE cl.company_id = ? 
          ORDER BY cl.entry_date DESC, cl.created_at DESC`,
    args: [company.id],
  });

  let totalIncome = 0;
  let totalExpense = 0;

  const entries: CompanyLedgerEntry[] = res.rows.map((r: any) => {
    const amount = Number(r.amount);
    const entryType = r.entry_type as "INCOME" | "EXPENSE";

    if (entryType === "INCOME") {
      totalIncome += amount;
    } else {
      totalExpense += amount;
    }

    return {
      id: String(r.id),
      companyId: String(r.company_id),
      userId: String(r.user_id),
      userName: String(r.parlamentum_name || r.display_name || r.username || "Operator"),
      entryType,
      category: String(r.category),
      amount,
      description: String(r.description),
      entryDate: String(r.entry_date),
      createdAt: String(r.created_at),
    };
  });

  const netProfit = Math.round((totalIncome - totalExpense) * 100) / 100;
  const profitMargin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 10000) / 100 : 0;

  return {
    success: true,
    company,
    entries,
    summary: {
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      netProfit,
      profitMargin,
      entriesCount: entries.length,
    },
  };
}

export async function addCompanyLedgerEntry(
  userId: string,
  isAdmin: boolean,
  companyIdOrTicker: string,
  params: {
    entryType: "INCOME" | "EXPENSE";
    category: string;
    amount: number;
    description: string;
    entryDate?: string;
  }
): Promise<{ success: boolean; message: string; entry?: CompanyLedgerEntry }> {
  await initDb();
  const db = getDb();

  // Verify authorization: must be company creator or exchange operator (admin)
  const compRes = await db.execute({
    sql: "SELECT id, ticker, creator_id FROM companies WHERE id = ? OR UPPER(ticker) = UPPER(?) LIMIT 1",
    args: [companyIdOrTicker, companyIdOrTicker],
  });
  if (compRes.rows.length === 0) {
    return { success: false, message: "Company not found." };
  }

  const company = compRes.rows[0];
  const companyId = String(company.id);
  const isCreator = String(company.creator_id) === userId;
  if (!isCreator && !isAdmin) {
    return { success: false, message: "Only the enterprise founder or exchange operator can record entries in the official company ledger." };
  }

  const numAmount = Math.round(Number(params.amount) * 100) / 100;
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    return { success: false, message: "Amount must be greater than 0 gold." };
  }

  if (!params.description || !params.description.trim()) {
    return { success: false, message: "Please provide a clear description of this financial transaction." };
  }

  const entryId = `cld_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const entryDate = params.entryDate ? params.entryDate.trim() : now.slice(0, 10);

  await db.execute({
    sql: `INSERT INTO company_ledger (id, company_id, user_id, entry_type, category, amount, description, entry_date, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      entryId,
      companyId,
      userId,
      params.entryType,
      params.category,
      numAmount,
      params.description.trim(),
      entryDate,
      now,
    ],
  });

  scheduleBlobPersist();

  return {
    success: true,
    message: `Recorded ${params.entryType === "INCOME" ? "+" : "-"}${numAmount.toLocaleString()} gold in $${company.ticker} ledger!`,
    entry: {
      id: entryId,
      companyId,
      userId,
      userName: "You",
      entryType: params.entryType,
      category: params.category,
      amount: numAmount,
      description: params.description.trim(),
      entryDate,
      createdAt: now,
    },
  };
}

export async function deleteCompanyLedgerEntry(
  userId: string,
  isAdmin: boolean,
  entryId: string
): Promise<{ success: boolean; message: string }> {
  await initDb();
  const db = getDb();

  const entryRes = await db.execute({
    sql: "SELECT cl.*, c.creator_id FROM company_ledger cl JOIN companies c ON cl.company_id = c.id WHERE cl.id = ?",
    args: [entryId],
  });
  if (entryRes.rows.length === 0) {
    return { success: false, message: "Ledger entry not found." };
  }

  const entry = entryRes.rows[0];
  const isCreator = String(entry.creator_id) === userId;
  const isAuthor = String(entry.user_id) === userId;

  if (!isCreator && !isAuthor && !isAdmin) {
    return { success: false, message: "You are not authorized to delete this ledger entry." };
  }

  await db.execute({
    sql: "DELETE FROM company_ledger WHERE id = ?",
    args: [entryId],
  });

  scheduleBlobPersist();

  return { success: true, message: "Ledger entry removed." };
}
