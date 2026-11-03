import { getDb, initDb, scheduleBlobPersist } from "./db";
import crypto from "crypto";

export interface ReferralCodeInfo {
  code: string;
  ownerId: string;
  ownerName: string;
  commissionPct: number;
  totalReferred: number;
  totalVolume: number;
  totalEarned: number;
  createdAt: string;
}

export interface ReferralRewardItem {
  id: string;
  referrerId: string;
  referrerName: string;
  referralCode: string;
  referredUserId: string;
  referredUsername: string;
  sourceType: string;
  tradeId?: string;
  tradeVolume: number;
  commissionGold: number;
  createdAt: string;
}

/**
 * Gets or automatically generates an active referral code for a user.
 */
export async function getOrCreateUserReferralCode(userId: string, username: string): Promise<ReferralCodeInfo> {
  await initDb();
  const db = getDb();

  const existing = await db.execute({
    sql: "SELECT * FROM referral_codes WHERE owner_id = ? LIMIT 1",
    args: [userId],
  });

  if (existing.rows.length > 0) {
    const r: any = existing.rows[0];
    return {
      code: String(r.code),
      ownerId: String(r.owner_id),
      ownerName: String(r.owner_name),
      commissionPct: Number(r.commission_pct) || 20.0,
      totalReferred: Number(r.total_referred) || 0,
      totalVolume: Number(r.total_volume) || 0.0,
      totalEarned: Number(r.total_earned) || 0.0,
      createdAt: String(r.created_at),
    };
  }

  // Generate clean alphanumeric code from username (e.g. TEXY)
  let cleanCode = username.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleanCode.length < 3) cleanCode = `GUG${cleanCode}`;
  if (cleanCode.length > 12) cleanCode = cleanCode.slice(0, 12);

  // Check collision
  const check = await db.execute({
    sql: "SELECT code FROM referral_codes WHERE UPPER(code) = ?",
    args: [cleanCode],
  });

  if (check.rows.length > 0) {
    cleanCode = `${cleanCode}${Math.floor(100 + Math.random() * 900)}`;
  }

  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT OR IGNORE INTO referral_codes (code, owner_id, owner_name, commission_pct, total_referred, total_volume, total_earned, created_at)
          VALUES (?, ?, ?, 20.0, 0, 0.0, 0.0, ?)`,
    args: [cleanCode, userId, username, now],
  });

  scheduleBlobPersist();

  return {
    code: cleanCode,
    ownerId: userId,
    ownerName: username,
    commissionPct: 20.0,
    totalReferred: 0,
    totalVolume: 0.0,
    totalEarned: 0.0,
    createdAt: now,
  };
}

/**
 * Validates a referral code and attaches the referrer to the new user.
 */
export async function recordReferralSignup(newUserId: string, rawCode?: string): Promise<{ success: boolean; code?: string; referrerName?: string }> {
  if (!rawCode || !rawCode.trim()) return { success: false };
  const cleanCode = rawCode.trim().toUpperCase();

  await initDb();
  const db = getDb();

  const codeRes = await db.execute({
    sql: "SELECT * FROM referral_codes WHERE UPPER(code) = ? LIMIT 1",
    args: [cleanCode],
  });

  if (codeRes.rows.length === 0) {
    // If not in referral_codes table, check if it directly matches a citizen's username
    const userRes = await db.execute({
      sql: "SELECT id, username FROM users WHERE UPPER(username) = ? LIMIT 1",
      args: [cleanCode],
    });

    if (userRes.rows.length > 0) {
      const u: any = userRes.rows[0];
      if (u.id === newUserId) return { success: false }; // Can't refer self

      // Create referral code for this user on the fly
      const createdCode = await getOrCreateUserReferralCode(u.id, u.username);
      await db.execute({
        sql: "UPDATE users SET referred_by = ?, referral_code_used = ? WHERE id = ?",
        args: [u.id, createdCode.code, newUserId],
      });
      await db.execute({
        sql: "UPDATE referral_codes SET total_referred = total_referred + 1 WHERE code = ?",
        args: [createdCode.code],
      });
      scheduleBlobPersist();
      return { success: true, code: createdCode.code, referrerName: u.username };
    }

    return { success: false };
  }

  const codeRow: any = codeRes.rows[0];
  if (codeRow.owner_id === newUserId) {
    return { success: false }; // Can't refer self
  }

  await db.execute({
    sql: "UPDATE users SET referred_by = ?, referral_code_used = ? WHERE id = ?",
    args: [codeRow.owner_id, codeRow.code, newUserId],
  });

  await db.execute({
    sql: "UPDATE referral_codes SET total_referred = total_referred + 1 WHERE code = ?",
    args: [codeRow.code],
  });

  scheduleBlobPersist();
  return { success: true, code: codeRow.code, referrerName: codeRow.owner_name };
}

/**
 * Distributes trade commission to referrers when an order matches.
 */
export async function distributeTradeReferralCommissions(trade: {
  tradeId: string;
  buyerId: string;
  sellerId: string;
  matchCost: number;
  tradeFee: number;
}): Promise<void> {
  try {
    await initDb();
    const db = getDb();

    // Check Buyer and Seller
    const parties = [
      { id: trade.buyerId, role: "BUYER" },
      { id: trade.sellerId, role: "SELLER" },
    ];

    const now = new Date().toISOString();

    for (const party of parties) {
      // Find if this party has a referrer
      const userRes = await db.execute({
        sql: "SELECT id, username, referred_by, referral_code_used FROM users WHERE id = ?",
        args: [party.id],
      });

      if (userRes.rows.length === 0) continue;
      const user: any = userRes.rows[0];
      const referrerId = user.referred_by;
      if (!referrerId) continue;

      // Find referrer's code and commission rate
      const codeRes = await db.execute({
        sql: "SELECT * FROM referral_codes WHERE owner_id = ? LIMIT 1",
        args: [referrerId],
      });

      let commissionPct = 20.0;
      let refCode = user.referral_code_used || "REF";
      let referrerName = "Promoter";

      if (codeRes.rows.length > 0) {
        const c: any = codeRes.rows[0];
        commissionPct = Number(c.commission_pct) || 20.0;
        refCode = c.code;
        referrerName = c.owner_name;
      } else {
        const refUserRes = await db.execute({
          sql: "SELECT username FROM users WHERE id = ?",
          args: [referrerId],
        });
        if (refUserRes.rows.length > 0) {
          referrerName = String(refUserRes.rows[0].username);
        }
      }

      // Party generates 50% of the trade fee
      const partyFee = Math.round((trade.tradeFee / 2) * 100) / 100;
      const commissionGold = Math.round((partyFee * (commissionPct / 100)) * 100) / 100;

      if (commissionGold > 0) {
        // Credit gold to referrer's balance
        await db.execute({
          sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
          args: [commissionGold, referrerId],
        });

        // Record reward history
        const rewardId = `ref_rew_${crypto.randomUUID().slice(0, 8)}`;
        await db.execute({
          sql: `INSERT INTO referral_rewards 
                (id, referrer_id, referrer_name, referral_code, referred_user_id, referred_username, source_type, trade_id, trade_volume, commission_gold, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'TRADE_COMMISSION', ?, ?, ?, ?)`,
          args: [
            rewardId,
            referrerId,
            referrerName,
            refCode,
            user.id,
            user.username,
            trade.tradeId,
            trade.matchCost,
            commissionGold,
            now,
          ],
        });

        // Update referrer's cumulative volume and earnings
        await db.execute({
          sql: `UPDATE referral_codes 
                SET total_volume = total_volume + ?, total_earned = total_earned + ?
                WHERE code = ?`,
          args: [trade.matchCost, commissionGold, refCode],
        });
      }
    }

    scheduleBlobPersist();
  } catch (err) {
    console.warn("Non-fatal error in distributeTradeReferralCommissions:", err);
  }
}

/**
 * Returns complete referral dashboard for a user.
 */
export async function getUserReferralDashboard(userId: string, username: string) {
  await initDb();
  const db = getDb();

  const codeInfo = await getOrCreateUserReferralCode(userId, username);

  // List of referred citizens
  const citizensRes = await db.execute({
    sql: `SELECT id, username, display_name, created_at 
          FROM users WHERE referred_by = ? ORDER BY created_at DESC LIMIT 50`,
    args: [userId],
  });

  const referredCitizens = citizensRes.rows.map((r: any) => ({
    id: String(r.id),
    username: String(r.username),
    displayName: String(r.display_name || r.username),
    joinedAt: String(r.created_at),
  }));

  // List of recent referral rewards
  const rewardsRes = await db.execute({
    sql: `SELECT * FROM referral_rewards WHERE referrer_id = ? ORDER BY created_at DESC LIMIT 50`,
    args: [userId],
  });

  const rewards: ReferralRewardItem[] = rewardsRes.rows.map((r: any) => ({
    id: String(r.id),
    referrerId: String(r.referrer_id),
    referrerName: String(r.referrer_name),
    referralCode: String(r.referral_code),
    referredUserId: String(r.referred_user_id),
    referredUsername: String(r.referred_username),
    sourceType: String(r.source_type),
    tradeId: r.trade_id ? String(r.trade_id) : undefined,
    tradeVolume: Number(r.trade_volume) || 0,
    commissionGold: Number(r.commission_gold) || 0,
    createdAt: String(r.created_at),
  }));

  return {
    codeInfo,
    referredCitizens,
    rewards,
  };
}

/**
 * Admin action: create or update a custom referral code (e.g. Code 'TEXY' for user 'TEXY')
 */
export async function adminSetCustomReferralCode(params: {
  code: string;
  targetUsername: string;
  commissionPct?: number;
}): Promise<{ success: boolean; message: string }> {
  await initDb();
  const db = getDb();

  const cleanCode = params.code.trim().toUpperCase();
  const targetUser = params.targetUsername.trim();
  const commissionPct = Math.max(1, Math.min(50, Number(params.commissionPct) || 20.0));

  const userRes = await db.execute({
    sql: "SELECT id, username FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1",
    args: [targetUser],
  });

  if (userRes.rows.length === 0) {
    return { success: false, message: `Citizen @${targetUser} does not exist.` };
  }

  const u: any = userRes.rows[0];
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO referral_codes (code, owner_id, owner_name, commission_pct, total_referred, total_volume, total_earned, created_at)
          VALUES (?, ?, ?, ?, 0, 0.0, 0.0, ?)
          ON CONFLICT(code) DO UPDATE SET 
            owner_id = excluded.owner_id, 
            owner_name = excluded.owner_name, 
            commission_pct = excluded.commission_pct`,
    args: [cleanCode, u.id, u.username, commissionPct, now],
  });

  scheduleBlobPersist();
  return { success: true, message: `Referral code ${cleanCode} linked to @${u.username} with ${commissionPct}% commission.` };
}

/**
 * Admin action: get all referral codes and promoter stats
 */
export async function adminGetAllReferralCodes(): Promise<ReferralCodeInfo[]> {
  await initDb();
  const db = getDb();

  const res = await db.execute("SELECT * FROM referral_codes ORDER BY total_volume DESC, total_referred DESC");
  return res.rows.map((r: any) => ({
    code: String(r.code),
    ownerId: String(r.owner_id),
    ownerName: String(r.owner_name),
    commissionPct: Number(r.commission_pct) || 20.0,
    totalReferred: Number(r.total_referred) || 0,
    totalVolume: Number(r.total_volume) || 0,
    totalEarned: Number(r.total_earned) || 0,
    createdAt: String(r.created_at),
  }));
}
