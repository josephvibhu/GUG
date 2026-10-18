import { getDb, initDb } from "./db";
import bcrypt from "bcryptjs";

export const HOUSE_OPERATOR = "Parliament_Exchange";

export async function seedMarketData(force = false) {
  await initDb();
  const db = getDb();

  const userCountRes = await db.execute("SELECT COUNT(*) as count FROM users");
  const userCount = Number(userCountRes.rows[0].count);

  if (userCount > 0 && !force) {
    return;
  }

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

  // Create House Operator & Demo User
  // Initial cash balance is 0.0 - player loads money by buying grain in Parlamentum!
  const users = [
    {
      id: "usr_house",
      username: "Parliament_Exchange",
      password_hash: defaultPassword,
      display_name: "Parliament Exchange House",
      parlamentum_name: "Parliament_Exchange",
      cash_balance: 50000000.0,
      avatar: "🏛️",
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
      sql: `INSERT OR REPLACE INTO users (id, username, password_hash, display_name, parlamentum_name, cash_balance, locked_cash, avatar, is_admin, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0.0, ?, ?, ?)`,
      args: [u.id, u.username, u.password_hash, u.display_name, u.parlamentum_name, u.cash_balance, u.avatar, u.is_admin, now],
    });
  }

  // Note: NO PRE-SEEDED STOCKS. The exchange starts completely empty.
  // Companies are only created by citizens via the IPO launchpad (/ipo).
  console.log("Exchange initialized with 0 pre-stocks. Players create companies via IPO!");
}
