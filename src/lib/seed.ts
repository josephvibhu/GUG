import { getDb, initDb } from "./db";
import bcrypt from "bcryptjs";

export const HOUSE_OPERATOR = "Parliament_Exchange";

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
      parlamentum_name: "Parliament_Exchange",
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

  // Check if companies exist
  const companyCountRes = await db.execute("SELECT COUNT(*) as count FROM companies");
  const companyCount = Number(companyCountRes.rows[0].count);

  if (companyCount === 0 || force) {
    const hourBucket = now.slice(0, 13) + ":00:00Z";

    // 1. $IRON - Imperial Ironworks Guild
    const ironCompanyId = "cmp_iron_001";
    await db.execute({
      sql: `INSERT OR REPLACE INTO companies (id, ticker, name, description, sector, creator_id, total_shares, float_shares, ipo_price, current_price, change_24h, volume_24h, high_24h, low_24h, logo_url, status, created_at)
            VALUES (?, 'IRON', 'Imperial Ironworks Guild', 'Premier metallurgical syndicate supplying forged iron ingots, structural girders, and knight armaments across Parlamentum.', 'RAW_MATERIALS', 'usr_house', 50000, 35000, 10.0, 10.0, 2.5, 12500.0, 10.8, 9.6, '⚒️', 'ACTIVE', ?)`,
      args: [ironCompanyId, now],
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO portfolios (id, user_id, company_id, shares, locked_shares, avg_buy_price)
            VALUES (?, 'usr_house', ?, 15000, 0, 10.0)`,
      args: [`port_usr_house_IRON`, ironCompanyId],
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO portfolios (id, user_id, company_id, shares, locked_shares, avg_buy_price)
            VALUES (?, 'usr_treasury', ?, 35000, 35000, 10.0)`,
      args: [`port_treasury_IRON`, ironCompanyId],
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO orders (id, user_id, company_id, type, order_type, price, initial_quantity, remaining_quantity, status, created_at)
            VALUES (?, 'usr_treasury', ?, 'SELL', 'LIMIT', 10.0, 35000, 35000, 'OPEN', ?)`,
      args: [`ord_ipo_cmp_iron_001`, ironCompanyId, now],
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO candles (id, company_id, time_bucket, open, high, low, close, volume)
            VALUES (?, ?, ?, 10.0, 10.8, 9.6, 10.0, 1250)`,
      args: [`cnd_iron_init`, ironCompanyId, hourBucket],
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO announcements (id, company_id, title, content, author_id, created_at)
            VALUES (?, ?, 'Official IPO Charter: $IRON', 'The High Registrar of Parlamentum formally inaugurates $IRON. 35,000 primary shares released for public subscription at 10.00 gold.', 'usr_house', ?)`,
      args: [`anc_iron_init`, ironCompanyId, now],
    });

    // 2. $GRAIN - Royal Granary & Agriculture
    const grainCompanyId = "cmp_grain_001";
    await db.execute({
      sql: `INSERT OR REPLACE INTO companies (id, ticker, name, description, sector, creator_id, total_shares, float_shares, ipo_price, current_price, change_24h, volume_24h, high_24h, low_24h, logo_url, status, created_at)
            VALUES (?, 'GRAIN', 'Royal Granary & Provisions', 'Staple breadbasket cartel controlling granary silos, flour mills, and grain trade routes throughout the kingdom.', 'AGRICULTURE', 'usr_house', 100000, 70000, 4.5, 4.5, -1.1, 8400.0, 4.9, 4.3, '🌾', 'ACTIVE', ?)`,
      args: [grainCompanyId, now],
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO portfolios (id, user_id, company_id, shares, locked_shares, avg_buy_price)
            VALUES (?, 'usr_house', ?, 30000, 0, 4.5)`,
      args: [`port_usr_house_GRAIN`, grainCompanyId],
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO portfolios (id, user_id, company_id, shares, locked_shares, avg_buy_price)
            VALUES (?, 'usr_treasury', ?, 70000, 70000, 4.5)`,
      args: [`port_treasury_GRAIN`, grainCompanyId],
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO orders (id, user_id, company_id, type, order_type, price, initial_quantity, remaining_quantity, status, created_at)
            VALUES (?, 'usr_treasury', ?, 'SELL', 'LIMIT', 4.5, 70000, 70000, 'OPEN', ?)`,
      args: [`ord_ipo_cmp_grain_001`, grainCompanyId, now],
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO candles (id, company_id, time_bucket, open, high, low, close, volume)
            VALUES (?, ?, ?, 4.5, 4.9, 4.3, 4.5, 840)`,
      args: [`cnd_grain_init`, grainCompanyId, hourBucket],
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO announcements (id, company_id, title, content, author_id, created_at)
            VALUES (?, ?, 'Official IPO Charter: $GRAIN', 'Royal grain provisions syndicate chartered for public trade at 4.50 gold per share.', 'usr_house', ?)`,
      args: [`anc_grain_init`, grainCompanyId, now],
    });

    console.log("Exchange initialized with starter companies $IRON and $GRAIN!");
  }
}
