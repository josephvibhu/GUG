import { getDb, initDb, scheduleBlobPersist } from "./db";
import crypto from "crypto";

export type { StockGift } from "./giftTypes";
import type { StockGift } from "./giftTypes";

export async function createStockGift(
  userId: string,
  userName: string,
  companyId: string,
  shares: number,
  note?: string
): Promise<{ success: boolean; message: string; gift?: StockGift }> {
  await initDb();
  const db = getDb();

  const numShares = Math.floor(Number(shares));
  if (!Number.isFinite(numShares) || numShares <= 0) {
    return { success: false, message: "Gift quantity must be at least 1 share." };
  }

  const userRes = await db.execute({ sql: "SELECT is_frozen FROM users WHERE id = ?", args: [userId] });
  if (userRes.rows.length === 0 || Number(userRes.rows[0].is_frozen || 0) === 1) {
    return { success: false, message: "Your account is frozen. Contact the operator." };
  }

  // Fetch company details
  const compRes = await db.execute({
    sql: "SELECT id, ticker, name, status FROM companies WHERE id = ?",
    args: [companyId],
  });
  if (compRes.rows.length === 0) {
    return { success: false, message: "Company not found." };
  }
  const company = compRes.rows[0];
  if (String(company.status || "ACTIVE") !== "ACTIVE") {
    return { success: false, message: "Shares of a halted company can't be gifted." };
  }
  const ticker = String(company.ticker);
  const companyName = String(company.name);

  // Check user portfolio has enough unlocked shares
  const portRes = await db.execute({
    sql: "SELECT shares, locked_shares FROM portfolios WHERE user_id = ? AND company_id = ?",
    args: [userId, companyId],
  });
  if (portRes.rows.length === 0) {
    return { success: false, message: `You do not own any shares of $${ticker}.` };
  }
  const currentShares = Number(portRes.rows[0].shares);
  const lockedShares = Number(portRes.rows[0].locked_shares);
  const availableShares = currentShares - lockedShares;

  if (availableShares < numShares) {
    return {
      success: false,
      message: `You only have ${availableShares.toLocaleString()} free shares of $${ticker} available to gift (${lockedShares.toLocaleString()} locked in open sell orders).`,
    };
  }

  // Deduct shares from sender's portfolio atomically
  const debit = await db.execute({
    sql: "UPDATE portfolios SET shares = shares - ? WHERE user_id = ? AND company_id = ? AND (shares - locked_shares) >= ?",
    args: [numShares, userId, companyId, numShares],
  });
  if (debit.rowsAffected === 0) {
    return { success: false, message: "Insufficient free shares to create gift coupon." };
  }

  // Generate unique clean coupon code: GUG-TICKER-XXXXXX
  // 48 random bits: codes can't be guessed by trying them
  const randSuffix = crypto.randomBytes(6).toString("hex").toUpperCase();
  const code = `GUG-${ticker}-${randSuffix}`;
  const giftId = `gift_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO stock_gifts (id, code, sender_id, sender_name, company_id, ticker, company_name, shares, note, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
    args: [giftId, code, userId, userName, companyId, ticker, companyName, numShares, note ? note.trim() : null, now],
  });

  scheduleBlobPersist();

  return {
    success: true,
    message: `Gift coupon created for ${numShares.toLocaleString()} shares of $${ticker}! Share code: ${code}`,
    gift: {
      id: giftId,
      code,
      senderId: userId,
      senderName: userName,
      companyId,
      ticker,
      companyName,
      shares: numShares,
      note: note ? note.trim() : undefined,
      status: "ACTIVE",
      createdAt: now,
    },
  };
}

export async function redeemStockGift(
  userId: string,
  userName: string,
  rawCode: string
): Promise<{ success: boolean; message: string; gift?: StockGift }> {
  await initDb();
  const db = getDb();

  const cleanCode = rawCode.trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, message: "Please enter a valid gift coupon code." };
  }

  const userRes = await db.execute({ sql: "SELECT is_frozen FROM users WHERE id = ?", args: [userId] });
  if (userRes.rows.length === 0 || Number(userRes.rows[0].is_frozen || 0) === 1) {
    return { success: false, message: "Your account is frozen. Contact the operator." };
  }

  const giftRes = await db.execute({
    sql: "SELECT * FROM stock_gifts WHERE UPPER(code) = ?",
    args: [cleanCode],
  });

  // One answer for unknown and used codes, so the reply doesn't confirm which codes exist
  const invalid = { success: false, message: "That code isn't valid or has already been used." };
  if (giftRes.rows.length === 0 || giftRes.rows[0].status !== "ACTIVE") {
    return invalid;
  }

  const g = giftRes.rows[0];
  const giftId = String(g.id);
  const companyId = String(g.company_id);
  const ticker = String(g.ticker);
  const shares = Number(g.shares);
  const now = new Date().toISOString();
  const portId = `port_${userId}_${ticker}`;

  // Claim the voucher before moving any shares: only one redeem or cancel can win it
  const claim = await db.execute({
    sql: `UPDATE stock_gifts 
          SET status = 'REDEEMED', recipient_id = ?, recipient_name = ?, redeemed_at = ? 
          WHERE id = ? AND status = 'ACTIVE'`,
    args: [userId, userName, now, giftId],
  });
  if (claim.rowsAffected === 0) {
    return invalid;
  }

  // Credit shares into recipient's portfolio
  await db.execute({
    sql: `INSERT INTO portfolios (id, user_id, company_id, shares, locked_shares, avg_buy_price)
          VALUES (?, ?, ?, ?, 0, 0.0)
          ON CONFLICT(user_id, company_id) DO UPDATE SET shares = shares + excluded.shares`,
    args: [portId, userId, companyId, shares],
  });

  scheduleBlobPersist();

  return {
    success: true,
    message: `🎉 Gift claimed! You received ${shares.toLocaleString()} shares of $${ticker} (${g.company_name}) from ${g.sender_name}!`,
    gift: {
      id: giftId,
      code: String(g.code),
      senderId: String(g.sender_id),
      senderName: String(g.sender_name),
      companyId,
      ticker,
      companyName: String(g.company_name),
      shares,
      note: g.note ? String(g.note) : undefined,
      status: "REDEEMED",
      recipientId: userId,
      recipientName: userName,
      redeemedAt: now,
      createdAt: String(g.created_at),
    },
  };
}

export async function cancelStockGift(
  userId: string,
  giftId: string
): Promise<{ success: boolean; message: string }> {
  await initDb();
  const db = getDb();

  const giftRes = await db.execute({
    sql: "SELECT * FROM stock_gifts WHERE id = ? AND sender_id = ?",
    args: [giftId, userId],
  });

  if (giftRes.rows.length === 0) {
    return { success: false, message: "Gift voucher not found or you do not own it." };
  }

  const g = giftRes.rows[0];
  if (g.status !== "ACTIVE") {
    return { success: false, message: `Cannot cancel: this voucher is already ${String(g.status).toLowerCase()}.` };
  }

  const companyId = String(g.company_id);
  const shares = Number(g.shares);

  // Mark the voucher cancelled first, and only if it is still unclaimed, so the shares come back once
  const claim = await db.execute({
    sql: "UPDATE stock_gifts SET status = 'CANCELLED' WHERE id = ? AND sender_id = ? AND status = 'ACTIVE'",
    args: [giftId, userId],
  });
  if (claim.rowsAffected === 0) {
    return { success: false, message: "This voucher was already claimed or cancelled." };
  }

  // Return shares back to sender's portfolio
  await db.execute({
    sql: `INSERT INTO portfolios (id, user_id, company_id, shares, locked_shares, avg_buy_price)
          VALUES (?, ?, ?, ?, 0, 0.0)
          ON CONFLICT(user_id, company_id) DO UPDATE SET shares = shares + excluded.shares`,
    args: [`port_${userId}_${g.ticker}`, userId, companyId, shares],
  });

  scheduleBlobPersist();

  return {
    success: true,
    message: `Gift voucher ${g.code} cancelled. ${shares.toLocaleString()} shares of $${g.ticker} were returned to your portfolio!`,
  };
}

export async function getUserStockGifts(userId: string): Promise<{ sent: StockGift[]; received: StockGift[] }> {
  await initDb();
  const db = getDb();

  const [sentRes, recvRes] = await Promise.all([
    db.execute({
      sql: "SELECT * FROM stock_gifts WHERE sender_id = ? ORDER BY created_at DESC LIMIT 50",
      args: [userId],
    }),
    db.execute({
      sql: "SELECT * FROM stock_gifts WHERE recipient_id = ? ORDER BY redeemed_at DESC LIMIT 50",
      args: [userId],
    }),
  ]);

  const mapRow = (r: any): StockGift => ({
    id: String(r.id),
    code: String(r.code),
    senderId: String(r.sender_id),
    senderName: String(r.sender_name),
    companyId: String(r.company_id),
    ticker: String(r.ticker),
    companyName: String(r.company_name),
    shares: Number(r.shares),
    note: r.note ? String(r.note) : undefined,
    status: r.status as any,
    recipientId: r.recipient_id ? String(r.recipient_id) : undefined,
    recipientName: r.recipient_name ? String(r.recipient_name) : undefined,
    redeemedAt: r.redeemed_at ? String(r.redeemed_at) : undefined,
    createdAt: String(r.created_at),
  });

  return {
    sent: sentRes.rows.map(mapRow),
    received: recvRes.rows.map(mapRow),
  };
}
