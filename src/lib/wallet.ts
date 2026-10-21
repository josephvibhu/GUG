import { getDb, initDb, scheduleBlobPersist } from "./db";
import crypto from "crypto";

export interface DepositCommodity {
  id: "IRON" | "COTTON" | "COPPER";
  name: string;
  unitPrice: number;
  itemCodes: string[];
  emoji: string;
  badge: string;
  subtitle: string;
}

export const DEPOSIT_COMMODITIES: DepositCommodity[] = [
  {
    id: "IRON",
    name: "Raw Iron",
    unitPrice: 10,
    itemCodes: ["IRON_RAW", "RAW_IRON", "IRON"],
    emoji: "🪙",
    badge: "Raw Iron (10g)",
    subtitle: "10g / unit · for small deposits < 500g",
  },
  {
    id: "COTTON",
    name: "Raw Cotton",
    unitPrice: 100,
    itemCodes: ["COTTON_RAW", "RAW_COTTON", "COTTON"],
    emoji: "🌿",
    badge: "Raw Cotton (100g)",
    subtitle: "100g / unit · for deposits 500g–5,000g",
  },
  {
    id: "COPPER",
    name: "Raw Copper",
    unitPrice: 1000,
    itemCodes: ["COPPER_RAW", "RAW_COPPER", "COPPER"],
    emoji: "💎",
    badge: "Raw Copper (1,000g)",
    subtitle: "1,000g / unit · preserves reserves for large deposits",
  },
];

export const IRON_UNIT_PRICE = 10;
export const COTTON_UNIT_PRICE = 100;
export const COPPER_UNIT_PRICE = 1000;
export const ALLOWED_DEPOSIT_PRICES = [10, 100, 1000];

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

// Deposit calculation: Buy Raw Iron (10g), Raw Cotton (100g), or Raw Copper (1,000g)
export function calculateDepositRecipe(goldAmount: number, taxRate = 0, unitPrice = 10): RecipeResult {
  const matched = DEPOSIT_COMMODITIES.find((c) => c.unitPrice === unitPrice) || DEPOSIT_COMMODITIES[0];
  const price = matched.unitPrice;
  const name = matched.name;
  const units = Math.max(1, Math.ceil(goldAmount / price));
  const total = units * price;

  return {
    goldAmount,
    ironUnits: units,
    unitPrice: price,
    grossTotal: total,
    taxAmount: 0,
    netPayout: total,
    taxRatePercent: taxRate,
    instructions: `Buy ${units} ${name} listed by JosephArora at ${price} gold each (Total: ${total} gold).`,
  };
}

// Withdrawal calculation:
// The player requests goldAmount to be withdrawn from their purse.
// The House buys the player's Raw Iron listing for goldAmount gross.
// Parlamentum deducts the regional sales tax upon purchase; the player receives the net gold in-game.
export function calculateWithdrawalRecipe(goldAmount: number, taxRate = 10): RecipeResult {
  const t = Math.max(0, Math.min(50, taxRate)) / 100;
  const gross = Math.round(goldAmount * 100) / 100;
  const taxDeducted = Math.round(gross * t * 100) / 100;
  const netPayout = Math.max(0, Math.round((gross - taxDeducted) * 100) / 100);
  
  // Proportional 1 Raw Iron per ~10 gold (minimum 1 unit)
  const ironUnits = Math.max(1, Math.ceil(gross / IRON_UNIT_PRICE));
  const unitPrice = Math.round((gross / ironUnits) * 100) / 100;

  return {
    goldAmount,
    ironUnits,
    unitPrice,
    grossTotal: gross,
    taxAmount: taxDeducted,
    netPayout,
    taxRatePercent: taxRate,
    instructions: `List ${ironUnits} Raw Iron on the market at ${unitPrice.toFixed(2)} gold each (Total: ${gross.toFixed(2)} gold). The House will buy your listing for ${gross.toFixed(2)} gold. Parlamentum deducts the regional sales tax (~${taxDeducted.toFixed(2)}g at ${taxRate}%), leaving ~${netPayout.toFixed(2)} gold in your game purse.`,
  };
}

// Admin / Webhook: Process and approve deposit or fulfill withdrawal
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
  const type = String(tx.type);

  if (type === "WITHDRAWAL") {
    // Withdrawal fulfillment: gold was already deducted upon request.
    // Operator confirmed in-game purchase in Parlamentum.
    const done = await db.execute({
      sql: "UPDATE wallet_transactions SET status = 'COMPLETED' WHERE id = ? AND status = 'PENDING'",
      args: [txId],
    });
    if (done.rowsAffected === 0) {
      return { success: false, message: "Transaction not found or already processed." };
    }
    return { success: true, message: `Withdrawal of ${amount.toLocaleString()} gold marked as fulfilled! In-game purchase confirmed.` };
  }

  // Otherwise DEPOSIT: mark it credited first (only while still PENDING) so it can only be credited once
  const claim = await db.execute({
    sql: "UPDATE wallet_transactions SET status = 'CREDITED' WHERE id = ? AND status = 'PENDING'",
    args: [txId],
  });
  if (claim.rowsAffected === 0) {
    return { success: false, message: "Transaction not found or already processed." };
  }

  // Credit user purse
  await db.execute({
    sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
    args: [amount, userId],
  });

  scheduleBlobPersist();
  return { success: true, message: `Approved and credited ${amount.toLocaleString()} gold to citizen's purse!` };
}

// Admin: Reject deposit or cancel & refund withdrawal
export async function rejectTransaction(txId: string): Promise<{ success: boolean; message: string }> {
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
  const type = String(tx.type);

  // Reject only while still PENDING, so a withdrawal is refunded at most once (and never after it was fulfilled)
  const claim = await db.execute({
    sql: "UPDATE wallet_transactions SET status = 'REJECTED' WHERE id = ? AND status = 'PENDING'",
    args: [txId],
  });
  if (claim.rowsAffected === 0) {
    return { success: false, message: "Transaction not found or already processed." };
  }

  if (type === "WITHDRAWAL") {
    // Refund the deducted gold back to the citizen!
    await db.execute({
      sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
      args: [amount, userId],
    });
    scheduleBlobPersist();
    return { success: true, message: `Withdrawal cancelled and ${amount.toLocaleString()} gold refunded back to citizen's purse.` };
  }

  scheduleBlobPersist();
  return { success: true, message: "Deposit announcement rejected." };
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

  scheduleBlobPersist();
  return {
    success: true,
    message: `Successfully credited ${amount.toLocaleString()} gold (${ironUnits} Raw Iron) to ${user.username}!`,
    newBalance: Number(updated.rows[0].cash_balance),
  };
}
