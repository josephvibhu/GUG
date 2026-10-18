import { getDb, initDb } from "./db";
import crypto from "crypto";

export const IRON_UNIT_PRICE = 5; // 5 gold per Raw Iron

export interface RecipeResult {
  goldAmount: number;
  ironUnits: number;
  unitPrice: number;
  grossTotal: number;
  taxAmount: number;
  netPayout: number;
  taxRatePercent: number;
  instructions: string;
}

export async function getSetting(key: string, defaultValue: string): Promise<string> {
  await initDb();
  const db = getDb();
  const res = await db.execute({
    sql: "SELECT value FROM settings WHERE key = ?",
    args: [key],
  });
  if (res.rows.length === 0) return defaultValue;
  return String(res.rows[0].value);
}

export async function setSetting(key: string, value: string): Promise<void> {
  await initDb();
  const db = getDb();
  await db.execute({
    sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    args: [key, value],
  });
}

// Deposit calculation: Buy Raw Iron at 5g each
export function calculateDepositRecipe(goldAmount: number, taxRate = 0): RecipeResult {
  const units = Math.max(1, Math.ceil(goldAmount / IRON_UNIT_PRICE));
  const total = units * IRON_UNIT_PRICE;

  return {
    goldAmount,
    ironUnits: units,
    unitPrice: IRON_UNIT_PRICE,
    grossTotal: total,
    taxAmount: 0,
    netPayout: total,
    taxRatePercent: taxRate,
    instructions: `Buy ${units} Raw Iron listed by the House at 5 gold each (Total: ${total} gold).`,
  };
}

// Withdrawal calculation with tax negation:
// To ensure the player receives exactly goldAmount after Parlamentum sales tax deduction
export function calculateWithdrawalRecipe(goldAmount: number, taxRate = 10): RecipeResult {
  const t = Math.max(0, Math.min(50, taxRate)) / 100;
  // Listing gross required so that after (1 - t) deduction, user receives goldAmount:
  const gross = t < 1 ? Math.round((goldAmount / (1 - t)) * 100) / 100 : goldAmount;
  const taxNegated = Math.round((gross - goldAmount) * 100) / 100;
  
  // Use standard 100 Raw Iron units (or proportional for small amounts)
  const ironUnits = goldAmount >= 100 ? 100 : Math.max(10, Math.ceil(goldAmount / IRON_UNIT_PRICE));
  const unitPrice = Math.round((gross / ironUnits) * 100) / 100;

  return {
    goldAmount,
    ironUnits,
    unitPrice,
    grossTotal: gross,
    taxAmount: taxNegated,
    netPayout: goldAmount,
    taxRatePercent: taxRate,
    instructions: `List ${ironUnits} Raw Iron on the market at ${unitPrice.toFixed(2)} gold each (Total: ${gross.toFixed(2)} gold). The House pays the extra ${taxNegated.toFixed(2)} gold to absorb the ${taxRate}% market tax so you receive exactly ${goldAmount} gold net!`,
  };
}

// Admin / Webhook: Process and approve deposit
export async function approveDeposit(txId: string): Promise<{ success: boolean; message: string }> {
  await initDb();
  const db = getDb();

  const txRes = await db.execute({
    sql: "SELECT * FROM wallet_transactions WHERE id = ? AND status = 'PENDING'",
    args: [txId],
  });

  if (txRes.rows.length === 0) {
    return { success: false, message: "Transaction not found or already processed." };
  }

  const tx = txRes.rows[0];
  const amount = Number(tx.amount);
  const userId = String(tx.user_id);

  await db.execute({
    sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
    args: [amount, userId],
  });

  await db.execute({
    sql: "UPDATE wallet_transactions SET status = 'CREDITED' WHERE id = ?",
    args: [txId],
  });

  return { success: true, message: `Approved and credited ${amount.toLocaleString()} gold to citizen's purse!` };
}

// Admin Manual Purse Load
export async function manualCreditCitizen(
  parlamentumName: string, 
  goldAmount: number, 
  reason = "Verified Parlamentum market sale"
): Promise<{ success: boolean; message: string; newBalance?: number }> {
  await initDb();
  const db = getDb();

  const cleanName = parlamentumName.trim();
  const userRes = await db.execute({
    sql: "SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(parlamentum_name) = ?",
    args: [cleanName.toLowerCase(), cleanName.toLowerCase()],
  });

  if (userRes.rows.length === 0) {
    return { success: false, message: `Citizen '${cleanName}' is not registered on the exchange.` };
  }

  const user = userRes.rows[0];
  const amount = Math.floor(goldAmount);
  const ironUnits = Math.ceil(amount / IRON_UNIT_PRICE);
  const txId = `tx_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  await db.execute({
    sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
    args: [amount, user.id],
  });

  await db.execute({
    sql: `INSERT INTO wallet_transactions (id, user_id, type, method, amount, iron_units, parlamentum_name, status, recipe_note, created_at)
          VALUES (?, ?, 'DEPOSIT', 'ADMIN_CREDIT', ?, ?, ?, 'CREDITED', ?, ?)`,
    args: [txId, user.id, amount, ironUnits, user.username, reason, now],
  });

  const updated = await db.execute({
    sql: "SELECT cash_balance FROM users WHERE id = ?",
    args: [user.id],
  });

  return {
    success: true,
    message: `Successfully credited ${amount.toLocaleString()} gold (${ironUnits} Raw Iron) to ${user.username}!`,
    newBalance: Number(updated.rows[0].cash_balance),
  };
}
