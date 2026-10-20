import { getDb, initDb, scheduleBlobPersist } from "./db";
import { approveDeposit, manualCreditCitizen, getSetting } from "./wallet";
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

    // One signature per fill whichever parser read it (the userscript and the cloud scrape format dates and
    // spaces differently). Fills stored before this change are still found under their old signature.
    const norm = (v: unknown) => String(v ?? "").normalize("NFKC").replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/gu, " ").trim().toLowerCase();
    const signature = `ledger2|${norm(cleanDate)}|${cleanSide}|${norm(cleanItem)}|${qty}|${totalAmount}|${currency}|${norm(withUser)}`;
    const legacySignature = item.signature || `ledger_${cleanDate}_${cleanSide}_${cleanItem.replace(/\s+/g, "_")}_${qty}_${totalAmount}_${currency}_${withUser}`;

    // Check if already logged
    const existing = await db.execute({
      sql: "SELECT id, status FROM parlamentum_ledger_entries WHERE signature IN (?, ?) LIMIT 1",
      args: [signature, legacySignature],
    });

    if (existing.rows.length > 0) {
      continue;
    }

    const entryId = `ledg_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    // Record the entry before crediting anything: the UNIQUE signature lets only one of several
    // concurrent syncs (e.g. two operator tabs) claim this fill, so it is credited once
    const claimed = await db.execute({
      sql: `INSERT OR IGNORE INTO parlamentum_ledger_entries (
              id, trade_date, side, item_name, quantity, price_str, total_amount, currency, tax_amount, with_user, status, matched_user_id, signature, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'LOGGED', NULL, ?, ?)`,
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
        signature,
        now,
      ],
    });
    if (claimed.rowsAffected === 0) {
      continue;
    }

    syncedCount++;
    let entryStatus = "LOGGED";
    let matchedUserId: string | null = null;

    // Check if this is a Raw Iron sale to an exchange citizen. Only gold sales count, and the purse is credited
    // with what the House actually received: the total less the tax the game took from it.
    const isRawIronSale = cleanSide === "SOLD" && cleanItem.toLowerCase().includes("raw iron") && totalAmount > 0 && currency === "gold";
    const netReceived = Math.max(0, Math.round((totalAmount - taxAmount) * 100) / 100);

    if (isRawIronSale && withUser && withUser !== "—") {
      // Find matching user in Grow UR Gold
      // The in-game name wins over a matching username or display name
      const userRes = await db.execute({
        sql: `SELECT id, username, parlamentum_name, cash_balance FROM users 
              WHERE LOWER(username) = ? 
                 OR LOWER(parlamentum_name) = ? 
                 OR LOWER(display_name) = ? 
                 OR LOWER(state_realm_name) = ?
              ORDER BY CASE WHEN LOWER(parlamentum_name) = ? THEN 0 WHEN LOWER(username) = ? THEN 1 ELSE 2 END, created_at ASC
              LIMIT 1`,
        args: [withUser.toLowerCase(), withUser.toLowerCase(), withUser.toLowerCase(), withUser.toLowerCase(), withUser.toLowerCase(), withUser.toLowerCase()],
      });

      if (userRes.rows.length > 0) {
        const citizen = userRes.rows[0];
        matchedUserId = String(citizen.id);

        // 1. Check if user has an active PENDING deposit for this sale's amount or iron quantity
        const pending = await db.execute({
          sql: `SELECT id, amount FROM wallet_transactions
                WHERE user_id = ? AND type = 'DEPOSIT' AND status = 'PENDING' 
                  AND (amount = ? OR iron_units = ?)
                ORDER BY created_at ASC LIMIT 1`,
          args: [citizen.id, totalAmount, qty],
        });

        if (pending.rows.length > 0) {
          const pendingTx = pending.rows[0];
          // Credit what arrived, not what was announced
          await db.execute({
            sql: "UPDATE wallet_transactions SET amount = ? WHERE id = ? AND status = 'PENDING'",
            args: [netReceived, pendingTx.id],
          });
          await approveDeposit(String(pendingTx.id));
          entryStatus = "MATCHED_PENDING";
          newCredits.push({
            user: String(citizen.username),
            gold: netReceived,
            item: cleanItem,
            reason: `Auto-verified pending deposit via /trade/ledger (${qty} ${cleanItem} · ${totalAmount}g)`,
          });
        } else {
          // 2. Prevent duplicate credits:
          // Check if the trade date is from today (UTC)
          const nowUtc = new Date();
          const todayM = String(nowUtc.getUTCMonth() + 1).padStart(2, "0");
          const todayD = String(nowUtc.getUTCDate()).padStart(2, "0");
          const todayY = String(nowUtc.getUTCFullYear());
          const todayY2 = todayY.slice(2);
          
          const isFromToday = 
            cleanDate.includes(`${todayM}/${todayD}/${todayY}`) || 
            cleanDate.includes(`${todayM}/${todayD}/${todayY2}`) ||
            cleanDate.includes(`${nowUtc.getUTCMonth() + 1}/${nowUtc.getUTCDate()}/${todayY}`);

          // Check if this user already has ANY credited deposit for this exact amount or units
          const alreadyCredited = await db.execute({
            sql: `SELECT id FROM wallet_transactions 
                  WHERE user_id = ? AND type = 'DEPOSIT' AND status = 'CREDITED'
                    AND (amount = ? OR iron_units = ?)
                  LIMIT 1`,
            args: [citizen.id, totalAmount, qty],
          });

          const autoApprove = (await getSetting("auto_approve_deposits", "false")) === "true";

          if (!isFromToday) {
            // From a past date: log only, never credit automatically
            entryStatus = "HISTORICAL_SYNC";
          } else if (autoApprove && alreadyCredited.rows.length === 0) {
            // New unannounced fill from today AND auto-approve is explicitly enabled
            await manualCreditCitizen(
              String(citizen.username),
              netReceived,
              `Verified in-game sale on /trade/ledger (${qty}x ${cleanItem} at ${priceStr})`
            );
            entryStatus = "AUTO_CREDITED";
            newCredits.push({
              user: String(citizen.username),
              gold: netReceived,
              item: cleanItem,
              reason: `Direct ledger credit: ${qty}x ${cleanItem} sold for ${totalAmount}g (${netReceived}g after tax)`,
            });
          } else {
            // Auto-approve is off, or a same-size deposit was already credited (a repeat deposit or a duplicate):
            // queue it as a PENDING deposit for the operator instead of dropping it
            const txId = `tx_${crypto.randomUUID().slice(0, 8)}`;
            await db.execute({
              sql: `INSERT INTO wallet_transactions (
                id, user_id, type, method, amount, iron_units, parlamentum_name, status, recipe_note, created_at
              ) VALUES (?, ?, 'DEPOSIT', 'MARKET_IRON', ?, ?, ?, 'PENDING', ?, ?)`,
              args: [
                txId,
                citizen.id,
                netReceived,
                qty,
                String(citizen.parlamentum_name || citizen.username),
                `Auto-detected unannounced sale on /trade/ledger (${qty}x ${cleanItem} for ${totalAmount}g). Awaiting operator approval.`,
                new Date().toISOString(),
              ],
            });
            entryStatus = "QUEUED_FOR_APPROVAL";
          }
        }
      } else {
        entryStatus = "UNREGISTERED_CITIZEN";
      }
    }

    if (entryStatus !== "LOGGED") {
      await db.execute({
        sql: "UPDATE parlamentum_ledger_entries SET status = ?, matched_user_id = ? WHERE id = ?",
        args: [entryStatus, matchedUserId, entryId],
      });
    }
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
