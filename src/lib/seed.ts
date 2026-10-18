import { getDb, initDb } from "./db";
import bcrypt from "bcryptjs";

export const HOUSE_OPERATOR = "JosephArora";

export async function seedMarketData(force = false) {
  await initDb();
  const db = getDb();

  // Clear all data if force
  if (force) {
    await db.execute("DELETE FROM announcements");
    await db.execute("DELETE FROM candles");
    await db.execute("DELETE FROM trades");
    await db.execute("DELETE FROM orders");
    await db.execute("DELETE FROM portfolios");
    await db.execute("DELETE FROM companies");
    await db.execute("DELETE FROM wallet_transactions");
    await db.execute("DELETE FROM users");
  }

  const defaultPassword = await bcrypt.hash("parlamentum123", 10);
  const now = new Date().toISOString();

  // Create House Operator, Treasury & Demo User
  // Initial cash balance is 0.0 for ALL users including admins - money must be loaded via Parlamentum!
  const users = [
    {
      id: "usr_house",
      username: "Parliament_Exchange",
      password_hash: defaultPassword,
      display_name: "Parliament Exchange House",
      parlamentum_name: "JosephArora",
      cash_balance: 0.0,
      avatar: "🏛️",
      is_admin: 1,
    },
    {
      id: "usr_treasury",
      username: "Parliament_Treasury",
      password_hash: defaultPassword,
      display_name: "Imperial Exchange Treasury",
      parlamentum_name: "Parliament_Treasury",
      cash_balance: 0.0,
      avatar: "🏦",
      is_admin: 1,
    },
    {
      id: "usr_vance",
      username: "Trader_Vance",
      password_hash: defaultPassword,
      display_name: "Vance Montgomery",
      parlamentum_name: "Trader_Vance",
      cash_balance: 0.0, // starts at 0, loaded via buying grain!
      avatar: "🎩",
      is_admin: 0,
    },
  ];

  for (const u of users) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO users (id, username, password_hash, display_name, parlamentum_name, cash_balance, locked_cash, avatar, is_admin, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0.0, ?, ?, ?)`,
      args: [u.id, u.username, u.password_hash, u.display_name, u.parlamentum_name, u.cash_balance, u.avatar, u.is_admin, now],
    });
  }

  // Ensure all admin wallets and exchange operator accounts are emptied (0.0 gold)
  await db.execute(`
    UPDATE users 
    SET cash_balance = 0.0, locked_cash = 0.0 
    WHERE is_admin = 1 OR id IN ('usr_house', 'usr_treasury')
  `);

  // Set default house_name setting to JosephArora and disable auto-approve for security
  await db.execute(`
    INSERT OR REPLACE INTO settings (key, value) VALUES ('house_name', 'JosephArora');
  `);
  await db.execute(`
    INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_approve_deposits', 'false');
  `);

  // Remove legacy/imperial iron companies and previous seeds
  const legacyComps = await db.execute("SELECT id FROM companies WHERE UPPER(ticker) IN ('IRON', 'GRAIN')");
  for (const row of legacyComps.rows) {
    const cId = String(row.id);
    await db.execute({ sql: "DELETE FROM orders WHERE company_id = ?", args: [cId] });
    await db.execute({ sql: "DELETE FROM candles WHERE company_id = ?", args: [cId] });
    await db.execute({ sql: "DELETE FROM announcements WHERE company_id = ?", args: [cId] });
    await db.execute({ sql: "DELETE FROM portfolios WHERE company_id = ?", args: [cId] });
    await db.execute({ sql: "DELETE FROM trades WHERE company_id = ?", args: [cId] });
    await db.execute({ sql: "DELETE FROM buybacks WHERE company_id = ?", args: [cId] });
    await db.execute({ sql: "DELETE FROM companies WHERE id = ?", args: [cId] });
  }
  await db.execute("DELETE FROM ipo_applications WHERE UPPER(ticker) IN ('IRON', 'GRAIN')");

  // Ensure Grow UR Gold (GUG) is chartered as the flagship sovereign marketplace company
  // Specs: Grow UR Gold - GUG, The Official Marketplace of the Singaporean Stock Exchange
  // List 10% at 1000 stocks each at 3 gold per stock (Total: 10,000 shares, 1,000 float, 9,000 founder)
  const gugRes = await db.execute("SELECT id FROM companies WHERE UPPER(ticker) = 'GUG'");
  if (gugRes.rows.length === 0 || force) {
    const hourBucket = now.slice(0, 13) + ":00:00Z";
    const gugCompanyId = "cmp_gug_001";
    const totalShares = 10000;
    const floatShares = 1000; // 10% listed
    const founderShares = 9000; // 90% retained
    const ipoPrice = 3.0;

    await db.execute({
      sql: `INSERT OR REPLACE INTO companies (id, ticker, name, description, sector, creator_id, total_shares, float_shares, ipo_price, current_price, change_24h, volume_24h, high_24h, low_24h, logo_url, status, created_at)
            VALUES (?, 'GUG', 'Grow UR Gold', 'The Official Marketplace of the Singaporean Stock Exchange', 'FINANCIAL_SERVICES', 'usr_house', ?, ?, ?, ?, 0.0, 0.0, ?, ?, '🪙', 'ACTIVE', ?)`,
      args: [gugCompanyId, totalShares, floatShares, ipoPrice, ipoPrice, ipoPrice, ipoPrice, now],
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO portfolios (id, user_id, company_id, shares, locked_shares, avg_buy_price)
            VALUES (?, 'usr_house', ?, ?, 0, ?)`,
      args: [`port_usr_house_GUG`, gugCompanyId, founderShares, ipoPrice],
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO portfolios (id, user_id, company_id, shares, locked_shares, avg_buy_price)
            VALUES (?, 'usr_treasury', ?, ?, ?, ?)`,
      args: [`port_treasury_GUG`, gugCompanyId, floatShares, floatShares, ipoPrice],
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO orders (id, user_id, company_id, type, order_type, price, initial_quantity, remaining_quantity, status, created_at)
            VALUES (?, 'usr_treasury', ?, 'SELL', 'LIMIT', ?, ?, ?, 'OPEN', ?)`,
      args: [`ord_ipo_cmp_gug_001`, gugCompanyId, ipoPrice, floatShares, floatShares, now],
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO candles (id, company_id, time_bucket, open, high, low, close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      args: [`cnd_gug_init`, gugCompanyId, hourBucket, ipoPrice, ipoPrice, ipoPrice, ipoPrice],
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO announcements (id, company_id, title, content, author_id, created_at)
            VALUES (?, ?, 'Official IPO Charter: $GUG (Grow UR Gold)', 'The Official Marketplace of the Singaporean Stock Exchange ($GUG) has formally listed on the sovereign exchange floor. 1,000 primary float shares (10% equity) are officially open for public subscription at 3.00 gold per stock.', 'usr_house', ?)`,
      args: [`anc_gug_init`, gugCompanyId, now],
    });

    console.log("Exchange initialized with premier flagship company $GUG (Grow UR Gold)!");
  }
}
