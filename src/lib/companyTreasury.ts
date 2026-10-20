import crypto from "crypto";
import { getDb, initDb, scheduleBlobPersist } from "./db";

// Founders move gold between their own purse and their company's treasury. Each move is a public
// company-ledger entry, so shareholders can see when treasury gold comes and goes.

const round2 = (n: number) => Math.round(n * 100) / 100;
// Balances are stored as floats; a "move everything" request may be a hair above the stored value
const EPSILON = 0.000001;

export async function moveFounderGold(params: {
  userId: string;
  ticker: string;
  direction: "TO_COMPANY" | "TO_WALLET";
  amount: number;
  note?: string;
}): Promise<{ success: boolean; message: string; treasuryBalance?: number; cashBalance?: number }> {
  await initDb();
  const db = getDb();

  const amount = round2(Number(params.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, message: "Enter an amount of gold above 0." };
  }
  if (params.direction !== "TO_COMPANY" && params.direction !== "TO_WALLET") {
    return { success: false, message: "Choose where the gold goes." };
  }
  const note = (params.note || "").trim().slice(0, 140);

  const compRes = await db.execute({
    sql: "SELECT id, ticker, creator_id, status FROM companies WHERE UPPER(ticker) = UPPER(?) OR id = ? LIMIT 1",
    args: [params.ticker, params.ticker],
  });
  if (compRes.rows.length === 0) return { success: false, message: "Company not found." };
  const company = compRes.rows[0];
  const companyId = String(company.id);
  if (String(company.creator_id) !== params.userId) {
    return { success: false, message: "Only the founder can move gold in and out of the company treasury." };
  }

  const userRes = await db.execute({ sql: "SELECT is_frozen FROM users WHERE id = ?", args: [params.userId] });
  if (userRes.rows.length === 0) return { success: false, message: "Account not found." };
  if (Number(userRes.rows[0].is_frozen || 0) === 1) {
    return { success: false, message: "Your account is frozen. Contact the operator." };
  }

  const now = new Date().toISOString();

  if (params.direction === "TO_COMPANY") {
    // Take the gold from the purse first, only if it is still there (parallel requests can't overdraw)
    const debit = await db.execute({
      sql: "UPDATE users SET cash_balance = MAX(0, ROUND(cash_balance - ?, 2)) WHERE id = ? AND cash_balance >= ? - ?",
      args: [amount, params.userId, amount, EPSILON],
    });
    if (debit.rowsAffected === 0) {
      return { success: false, message: "Your purse doesn't hold that much gold." };
    }
    await db.execute({
      sql: "UPDATE companies SET treasury_balance = ROUND(treasury_balance + ?, 2) WHERE id = ?",
      args: [amount, companyId],
    });
  } else {
    if (String(company.status) !== "ACTIVE") {
      return { success: false, message: "The operator has frozen this company's treasury while it is halted." };
    }
    const debit = await db.execute({
      sql: `UPDATE companies SET treasury_balance = MAX(0, ROUND(treasury_balance - ?, 2))
            WHERE id = ? AND creator_id = ? AND treasury_balance >= ? - ?`,
      args: [amount, companyId, params.userId, amount, EPSILON],
    });
    if (debit.rowsAffected === 0) {
      return { success: false, message: "The company treasury doesn't hold that much gold." };
    }
    await db.execute({
      sql: "UPDATE users SET cash_balance = ROUND(cash_balance + ?, 2) WHERE id = ?",
      args: [amount, params.userId],
    });
  }

  const toCompany = params.direction === "TO_COMPANY";
  await db.execute({
    sql: `INSERT INTO company_ledger (id, company_id, user_id, entry_type, category, amount, description, entry_date, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `cld_${crypto.randomUUID()}`,
      companyId,
      params.userId,
      toCompany ? "INCOME" : "EXPENSE",
      toCompany ? "FOUNDER_DEPOSIT" : "FOUNDER_WITHDRAWAL",
      amount,
      (toCompany ? "Founder moved gold into the treasury" : "Founder moved gold to their purse") + (note ? `: ${note}` : ""),
      now.slice(0, 10),
      now,
    ],
  });

  scheduleBlobPersist();

  const [t, u] = await Promise.all([
    db.execute({ sql: "SELECT treasury_balance FROM companies WHERE id = ?", args: [companyId] }),
    db.execute({ sql: "SELECT cash_balance FROM users WHERE id = ?", args: [params.userId] }),
  ]);
  return {
    success: true,
    message: toCompany
      ? `Moved ${amount.toLocaleString()} gold into the ${company.ticker} treasury.`
      : `Moved ${amount.toLocaleString()} gold from the ${company.ticker} treasury to your purse.`,
    treasuryBalance: Number(t.rows[0]?.treasury_balance || 0),
    cashBalance: Number(u.rows[0]?.cash_balance || 0),
  };
}

// Everything a founder may change after listing. The IPO terms (ticker, share count, float, IPO price)
// stay as approved.
export interface CompanyProfileUpdate {
  name?: string;
  description?: string;
  sector?: string;
  logoUrl?: string;
  weeklyRevenue?: number;
  discordHandle?: string;
}

export async function updateCompanyProfile(params: {
  userId: string;
  isAdmin: boolean;
  ticker: string;
  update: CompanyProfileUpdate;
}): Promise<{ success: boolean; message: string }> {
  await initDb();
  const db = getDb();

  const compRes = await db.execute({
    sql: "SELECT id, ticker, creator_id FROM companies WHERE UPPER(ticker) = UPPER(?) OR id = ? LIMIT 1",
    args: [params.ticker, params.ticker],
  });
  if (compRes.rows.length === 0) return { success: false, message: "Company not found." };
  const company = compRes.rows[0];
  if (String(company.creator_id) !== params.userId && !params.isAdmin) {
    return { success: false, message: "Only the founder or the operator can edit this company." };
  }

  const u = params.update;
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  if (u.name !== undefined) {
    const name = text(u.name);
    if (name.length < 2 || name.length > 60) return { success: false, message: "The name needs 2 to 60 characters." };
    sets.push("name = ?");
    args.push(name);
  }
  if (u.description !== undefined) {
    const description = text(u.description);
    if (!description || description.length > 1000) return { success: false, message: "The description needs 1 to 1,000 characters." };
    sets.push("description = ?");
    args.push(description);
  }
  if (u.sector !== undefined) {
    const sector = text(u.sector);
    if (!sector || sector.length > 40) return { success: false, message: "The sector needs 1 to 40 characters." };
    sets.push("sector = ?");
    args.push(sector);
  }
  if (u.logoUrl !== undefined) {
    const logo = text(u.logoUrl);
    if (!logo || logo.length > 16) return { success: false, message: "Pick an emoji for the logo." };
    sets.push("logo_url = ?");
    args.push(logo);
  }
  if (u.weeklyRevenue !== undefined) {
    const revenue = round2(Number(u.weeklyRevenue));
    if (!Number.isFinite(revenue) || revenue < 0 || revenue > 10_000_000) {
      return { success: false, message: "Weekly revenue must be 0 or more gold." };
    }
    sets.push("weekly_revenue = ?");
    args.push(revenue);
  }
  if (u.discordHandle !== undefined) {
    const handle = text(u.discordHandle);
    if (handle.length > 40) return { success: false, message: "The Discord handle is too long." };
    sets.push("discord_handle = ?");
    args.push(handle || null);
  }

  if (sets.length === 0) return { success: false, message: "Nothing to change." };

  await db.execute({ sql: `UPDATE companies SET ${sets.join(", ")} WHERE id = ?`, args: [...args, String(company.id)] });
  scheduleBlobPersist();
  return { success: true, message: `${company.ticker} updated.` };
}

export async function getCompanyDiscordHandle(companyId: string): Promise<string> {
  await initDb();
  const res = await getDb().execute({ sql: "SELECT discord_handle FROM companies WHERE id = ?", args: [companyId] });
  return res.rows[0]?.discord_handle ? String(res.rows[0].discord_handle) : "";
}
