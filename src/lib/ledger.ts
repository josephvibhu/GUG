import { getDb, initDb, scheduleBlobPersist } from "./db";
import { approveDeposit, manualCreditCitizen } from "./wallet";
import crypto from "crypto";

export interface LedgerEntryInput {
  date: string;
  side: string;        // "SOLD" | "BOUGHT"
  item: string;        // e.g. "Raw Iron", "Food T1", "Ship T1"
  qty: number;
  price: string;       // e.g. "5.50 gold"
  total: number;       // e.g. 11.00
  tax?: number;        // e.g. 0.55
  currency?: string;   // "gold" | "USD"
  withUser?: string;   // e.g. "CardinalSanjay"
  signature?: string;
}

export interface TradeItemStat {
  item: string;
  bought: number;
  sold: number;
  spent: number;
  earned: number;
  net: number;
  currency: string;
}

export interface TradeStatsInput {
  totalFills?: number;
  boughtFills?: number;
  soldFills?: number;
  itemsCount?: number;
  itemsBreakdown?: TradeItemStat[];
}

export async function initLedgerTable() {
  await initDb();
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS parlamentum_ledger_entries (
      id TEXT PRIMARY KEY,
      trade_date TEXT NOT NULL,
      side TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      price_str TEXT NOT NULL,
      total_amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'gold',
      tax_amount REAL NOT NULL DEFAULT 0.0,
      with_user TEXT,
      status TEXT NOT NULL DEFAULT 'LOGGED',
      matched_user_id TEXT,
      signature TEXT UNIQUE,
      created_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_ledger_sig ON parlamentum_ledger_entries(signature);
  `);
}

/**
 * Ingests in-game ledger entries from https://parlamentum.org/trade/ledger
 * When a "SOLD" row for "Raw Iron" with a citizen counterparty (e.g. "CardinalSanjay") is found,
 * it auto-credits the citizen's purse in Grow UR Gold with zero latency!
 */
export async function syncLedgerData(
  entries: LedgerEntryInput[],
  stats?: TradeStatsInput
): Promise<{
  success: boolean;
  totalSynced: number;
  newCredits: Array<{ user: string; gold: number; item: string; reason: string }>;
}> {
  await initLedgerTable();
  const db = getDb();

  const newCredits: Array<{ user: string; gold: number; item: string; reason: string }> = [];
  let syncedCount = 0;

  for (const item of entries) {
    const cleanDate = (item.date || "").trim();
    const cleanSide = (item.side || "").toUpperCase().includes("SOLD") ? "SOLD" : "BOUGHT";
    const cleanItem = (item.item || "").trim();
    const qty = Number(item.qty) || 0;
    const priceStr = (item.price || "").trim();
    const totalAmount = Number(item.total) || 0;
    const taxAmount = Number(item.tax) || 0;
    const currency = (item.currency || (priceStr.toLowerCase().includes("usd") ? "USD" : "gold")).toLowerCase();
    const withUser = (item.withUser || "").trim().replace(/^[@—\-\s]+|[@—\-\s]+$/g, "");

    // Generate unique signature to avoid duplicate crediting
    const signature = item.signature || `ledger_${cleanDate}_${cleanSide}_${cleanItem.replace(/\s+/g, "_")}_${qty}_${totalAmount}_${currency}_${withUser}`;

    // Check if already logged
    const existing = await db.execute({
      sql: "SELECT id, status FROM parlamentum_ledger_entries WHERE signature = ? LIMIT 1",
      args: [signature],
    });

    if (existing.rows.length > 0) {
      continue;
    }

    syncedCount++;
    const entryId = `ledg_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    let entryStatus = "LOGGED";
    let matchedUserId: string | null = null;

    // Check if this is a Raw Iron sale to an exchange citizen
    const isRawIronSale = cleanSide === "SOLD" && cleanItem.toLowerCase().includes("raw iron") && totalAmount > 0;

    if (isRawIronSale && withUser && withUser !== "—") {
      // Find matching user in Grow UR Gold
      const userRes = await db.execute({
        sql: `SELECT id, username, cash_balance FROM users 
              WHERE LOWER(username) = ? 
                 OR LOWER(parlamentum_name) = ? 
                 OR LOWER(display_name) = ? 
                 OR LOWER(state_realm_name) = ?
              LIMIT 1`,
        args: [withUser.toLowerCase(), withUser.toLowerCase(), withUser.toLowerCase(), withUser.toLowerCase()],
      });

      if (userRes.rows.length > 0) {
        const citizen = userRes.rows[0];
        matchedUserId = String(citizen.id);

        // 1. Check if user has an active PENDING deposit for exactly this sale's amount
        // (otherwise the sale is credited directly below, so a large claimed deposit can't be settled by a small sale)
        const pending = await db.execute({
          sql: `SELECT id, amount FROM wallet_transactions
                WHERE user_id = ? AND type = 'DEPOSIT' AND status = 'PENDING' AND amount = ?
                ORDER BY created_at ASC LIMIT 1`,
          args: [citizen.id, totalAmount],
        });

        if (pending.rows.length > 0) {
          const pendingTx = pending.rows[0];
          await approveDeposit(String(pendingTx.id));
          entryStatus = "MATCHED_PENDING";
          newCredits.push({
            user: String(citizen.username),
            gold: totalAmount,
            item: cleanItem,
            reason: `Auto-verified pending deposit via /trade/ledger (${qty} ${cleanItem} · ${totalAmount}g)`,
          });
        } else {
          // 2. Direct instant credit to purse!
          await manualCreditCitizen(
            String(citizen.username),
            totalAmount,
            `Verified in-game sale on /trade/ledger (${qty}x ${cleanItem} at ${priceStr})`
          );
          entryStatus = "AUTO_CREDITED";
          newCredits.push({
            user: String(citizen.username),
            gold: totalAmount,
            item: cleanItem,
            reason: `Direct ledger credit: ${qty}x ${cleanItem} sold for ${totalAmount}g`,
          });
        }
      } else {
        entryStatus = "UNREGISTERED_CITIZEN";
      }
    }

    await db.execute({
      sql: `INSERT INTO parlamentum_ledger_entries (
              id, trade_date, side, item_name, quantity, price_str, total_amount, currency, tax_amount, with_user, status, matched_user_id, signature, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        entryId,
        cleanDate,
        cleanSide,
        cleanItem,
        qty,
        priceStr,
        totalAmount,
        currency,
        taxAmount,
        withUser || null,
        entryStatus,
        matchedUserId,
        signature,
        now,
      ],
    });
  }

  // Save high-level stats if provided
  if (stats) {
    const statsJson = JSON.stringify({
      ...stats,
      lastSyncedAt: new Date().toISOString(),
    });
    await db.execute({
      sql: "INSERT OR REPLACE INTO settings (key, value) VALUES ('parlamentum_trade_insights', ?)",
      args: [statsJson],
    });
  }

  if (syncedCount > 0 || stats) {
    scheduleBlobPersist();
  }

  return {
    success: true,
    totalSynced: syncedCount,
    newCredits,
  };
}

export async function getLedgerEntries(limit = 60) {
  await initLedgerTable();
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT id, trade_date, side, item_name, quantity, price_str, total_amount, currency, tax_amount, with_user, status, matched_user_id, created_at 
          FROM parlamentum_ledger_entries 
          ORDER BY created_at DESC 
          LIMIT ?`,
    args: [limit],
  });

  return res.rows.map((r: any) => ({
    id: String(r.id),
    tradeDate: String(r.trade_date),
    side: String(r.side),
    itemName: String(r.item_name),
    quantity: Number(r.quantity),
    priceStr: String(r.price_str),
    totalAmount: Number(r.total_amount),
    currency: String(r.currency),
    taxAmount: Number(r.tax_amount),
    withUser: r.with_user ? String(r.with_user) : null,
    status: String(r.status),
    matchedUserId: r.matched_user_id ? String(r.matched_user_id) : null,
    createdAt: String(r.created_at),
  }));
}

export async function getTradeInsights(): Promise<any | null> {
  await initDb();
  const db = getDb();
  const res = await db.execute({
    sql: "SELECT value FROM settings WHERE key = 'parlamentum_trade_insights' LIMIT 1",
  });
  if (res.rows.length === 0) return null;
  try {
    return JSON.parse(String(res.rows[0].value));
  } catch {
    return null;
  }
}
