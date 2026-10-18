import { createClient, Client } from "@libsql/client";
import path from "path";

let clientInstance: Client | null = null;

export function getDb(): Client {
  if (!clientInstance) {
    const databaseUrl = process.env.DATABASE_URL;
    const authToken = process.env.DATABASE_AUTH_TOKEN;

    if (databaseUrl) {
      clientInstance = createClient({
        url: databaseUrl,
        authToken: authToken,
      });
    } else if (process.env.VERCEL) {
      // In Vercel serverless functions, /tmp is the only writable directory
      clientInstance = createClient({
        url: `file:/tmp/parlamentum_market.db`,
      });
    } else {
      const dbPath = path.resolve(process.cwd(), "parlamentum_market.db");
      clientInstance = createClient({
        url: `file:${dbPath}`,
      });
    }
  }
  return clientInstance;
}

let isInitialized = false;

export async function initDb(): Promise<void> {
  if (isInitialized) return;

  const db = getDb();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      parlamentum_name TEXT,
      cash_balance REAL NOT NULL DEFAULT 0.0,
      locked_cash REAL NOT NULL DEFAULT 0.0,
      avatar TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('DEPOSIT', 'WITHDRAWAL')),
      method TEXT NOT NULL,
      amount REAL NOT NULL,
      iron_units INTEGER NOT NULL DEFAULT 0,
      parlamentum_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING', 'CREDITED', 'COMPLETED', 'REJECTED')),
      recipe_note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  try {
    await db.execute(`ALTER TABLE wallet_transactions ADD COLUMN iron_units INTEGER NOT NULL DEFAULT 0;`);
  } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      ticker TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      sector TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      total_shares INTEGER NOT NULL,
      float_shares INTEGER NOT NULL,
      ipo_price REAL NOT NULL,
      current_price REAL NOT NULL,
      change_24h REAL NOT NULL DEFAULT 0.0,
      volume_24h REAL NOT NULL DEFAULT 0.0,
      high_24h REAL NOT NULL,
      low_24h REAL NOT NULL,
      logo_url TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS portfolios (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      shares INTEGER NOT NULL DEFAULT 0,
      locked_shares INTEGER NOT NULL DEFAULT 0,
      avg_buy_price REAL NOT NULL DEFAULT 0.0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      UNIQUE(user_id, company_id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL')),
      order_type TEXT NOT NULL CHECK(order_type IN ('LIMIT', 'MARKET')),
      price REAL NOT NULL,
      initial_quantity INTEGER NOT NULL,
      remaining_quantity INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('OPEN', 'PARTIAL', 'FILLED', 'CANCELLED')),
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      buyer_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      buy_order_id TEXT,
      sell_order_id TEXT,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      total REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (seller_id) REFERENCES users(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS candles (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      time_bucket TEXT NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume INTEGER NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      UNIQUE(company_id, time_bucket)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (author_id) REFERENCES users(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ipo_applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      parlamentum_name TEXT NOT NULL,
      ticker TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      sector TEXT NOT NULL,
      proposed_total_shares INTEGER NOT NULL,
      proposed_ipo_price REAL NOT NULL,
      proposed_founder_retain_percent REAL NOT NULL,
      logo_url TEXT,
      status TEXT NOT NULL CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
      operator_notes TEXT,
      final_price REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Default settings
  await db.execute(`
    INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('tax_rate', '10'),
    ('iron_price', '5'),
    ('house_name', 'Parliament_Exchange'),
    ('api_key', 'pse_secret_parlamentum_key_2026'),
    ('auto_approve_deposits', 'true');
  `);

  isInitialized = true;
}
