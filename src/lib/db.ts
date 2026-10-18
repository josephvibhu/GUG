import { createClient, Client } from "@libsql/client";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Webhook key that used to ship as the default; never accept it
export const LEAKED_API_KEY = "pse_secret_parlamentum_key_2026";

let clientInstance: Client | null = null;
let lastBlobSyncedAt = 0;
let lastBlobCheckAt = 0;
let isSyncing = false;
let persistTimer: NodeJS.Timeout | null = null;

export function getDbPath(): string {
  if (process.env.VERCEL) {
    return "/tmp/parlamentum_market.db";
  }
  return path.resolve(process.cwd(), "parlamentum_market.db");
}

export async function syncDbFromBlob(force = false): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || process.env.DATABASE_URL) return;

  const now = Date.now();
  if (!force && now - lastBlobCheckAt < 3000) {
    return;
  }
  lastBlobCheckAt = now;

  if (isSyncing) return;
  isSyncing = true;

  try {
    const { head, get, put } = await import("@vercel/blob");
    const dbPath = getDbPath();
    const repoDbPath = path.resolve(process.cwd(), "parlamentum_market.db");

    let meta: any = null;
    try {
      meta = await head("parlamentum_market.db", { token });
    } catch {
      meta = null;
    }

    if (!meta) {
      if (fs.existsSync(repoDbPath)) {
        const buf = fs.readFileSync(repoDbPath);
        if (process.env.VERCEL) {
          fs.writeFileSync(dbPath, buf);
        }
        try {
          await put("parlamentum_market.db", buf, {
            token,
            access: "private",
            addRandomSuffix: false,
            allowOverwrite: true,
          });
        } catch {}
        lastBlobSyncedAt = Date.now();
      }
      return;
    }

    const remoteTime = new Date(meta.uploadedAt).getTime();
    const localExists = fs.existsSync(dbPath);

    if (force || !localExists || remoteTime > lastBlobSyncedAt) {
      const fileBlob = await get("parlamentum_market.db", { token, access: "private" });
      if (fileBlob && fileBlob.stream) {
        const buf = Buffer.from(await new Response(fileBlob.stream).arrayBuffer());
        if (clientInstance) {
          try {
            clientInstance.close();
          } catch {}
          clientInstance = null;
        }
        fs.writeFileSync(dbPath, buf);
        try { if (fs.existsSync(dbPath + "-wal")) fs.unlinkSync(dbPath + "-wal"); } catch {}
        try { if (fs.existsSync(dbPath + "-shm")) fs.unlinkSync(dbPath + "-shm"); } catch {}
        lastBlobSyncedAt = remoteTime;
      }
    }
  } catch (err) {
    console.warn("Failed to sync DB from Vercel Blob:", err);
  } finally {
    isSyncing = false;
  }
}

export async function persistDbToBlob(): Promise<{ success: boolean; error?: string }> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || process.env.DATABASE_URL) return { success: false, error: "No BLOB_READ_WRITE_TOKEN or DATABASE_URL set" };

  try {
    const dbPath = getDbPath();
    if (!fs.existsSync(dbPath)) return { success: false, error: "dbPath does not exist: " + dbPath };

    if (clientInstance) {
      try {
        await clientInstance.execute("PRAGMA wal_checkpoint(TRUNCATE);");
      } catch {}
    }

    const { put } = await import("@vercel/blob");
    const buf = fs.readFileSync(dbPath);
    await put("parlamentum_market.db", buf, {
      token,
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    lastBlobSyncedAt = Date.now();
    lastBlobCheckAt = Date.now();
    return { success: true };
  } catch (err: any) {
    console.error("Failed to persist DB to Vercel Blob:", err);
    return { success: false, error: err?.message || String(err) };
  }
}

export function scheduleBlobPersist(): void {
  if (process.env.DATABASE_URL || !process.env.BLOB_READ_WRITE_TOKEN) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistDbToBlob().catch((e) => console.warn("Background Blob persist error:", e));
  }, 300);
}

export function getDb(): Client {
  if (!clientInstance) {
    const databaseUrl = process.env.DATABASE_URL;
    const authToken = process.env.DATABASE_AUTH_TOKEN;

    if (databaseUrl) {
      clientInstance = createClient({
        url: databaseUrl,
        authToken: authToken,
      });
    } else {
      const dbPath = getDbPath();
      const repoDbPath = path.resolve(process.cwd(), "parlamentum_market.db");
      if (process.env.VERCEL && fs.existsSync(repoDbPath)) {
        try {
          let shouldCopy = !fs.existsSync(dbPath);
          if (!shouldCopy) {
            const repoStat = fs.statSync(repoDbPath);
            const dbStat = fs.statSync(dbPath);
            if (repoStat.mtimeMs > dbStat.mtimeMs) {
              shouldCopy = true;
            }
          }
          if (shouldCopy) {
            fs.copyFileSync(repoDbPath, dbPath);
          }
        } catch (e) {
          console.warn("Failed to copy bundled database to /tmp:", e);
        }
      }
      const rawClient = createClient({
        url: `file:${dbPath}`,
      });

      rawClient.execute("PRAGMA journal_mode = DELETE;").catch(() => {});

      const originalExecute = rawClient.execute.bind(rawClient);
      rawClient.execute = async function (stmt: any) {
        const res = await originalExecute(stmt);
        const sql = typeof stmt === "string" ? stmt : stmt?.sql;
        if (sql && /^\s*(INSERT|UPDATE|DELETE|REPLACE|ALTER)/i.test(sql)) {
          scheduleBlobPersist();
        }
        return res;
      };

      clientInstance = rawClient;
    }
  }
  return clientInstance;
}

let isInitialized = false;

export async function initDb(): Promise<void> {
  if (isInitialized) return;

  await syncDbFromBlob();

  const db = getDb();
  try {
    await db.execute("PRAGMA journal_mode = DELETE;");
  } catch {}

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

  // Must exist before the companies ALTER migrations below, or a fresh DB gets a companies table without them
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

  try {
    await db.execute(`ALTER TABLE wallet_transactions ADD COLUMN iron_units INTEGER NOT NULL DEFAULT 0;`);
  } catch {}

  try {
    await db.execute(`ALTER TABLE users ADD COLUMN is_frozen INTEGER NOT NULL DEFAULT 0;`);
  } catch {}

  try {
    await db.execute(`ALTER TABLE companies ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE';`);
  } catch {}

  try {
    await db.execute(`ALTER TABLE companies ADD COLUMN shares_bought_back INTEGER NOT NULL DEFAULT 0;`);
  } catch {}

  try {
    await db.execute(`ALTER TABLE companies ADD COLUMN buyback_gold_spent REAL NOT NULL DEFAULT 0.0;`);
  } catch {}

  try {
    await db.execute(`ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT 'CITIZEN';`);
  } catch {}

  try {
    await db.execute(`ALTER TABLE users ADD COLUMN state_realm_name TEXT;`);
  } catch {}

  try {
    await db.execute(`ALTER TABLE users ADD COLUMN state_motto TEXT;`);
  } catch {}

  try {
    await db.execute(`ALTER TABLE users ADD COLUMN state_delegate_name TEXT;`);
  } catch {}

  try {
    await db.execute(`ALTER TABLE users ADD COLUMN state_crest TEXT DEFAULT '🏛️';`);
  } catch {}

  try {
    await db.execute(`ALTER TABLE companies ADD COLUMN dividend_rate REAL NOT NULL DEFAULT 50.0;`);
  } catch {}

  try {
    await db.execute(`ALTER TABLE companies ADD COLUMN total_dividends_paid REAL NOT NULL DEFAULT 0.0;`);
  } catch {}

  try {
    await db.execute(`ALTER TABLE companies ADD COLUMN last_dividend_date TEXT;`);
  } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS earnings_reports (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      reporter_id TEXT NOT NULL,
      period_title TEXT NOT NULL,
      gross_revenue REAL NOT NULL DEFAULT 0.0,
      operating_expenses REAL NOT NULL DEFAULT 0.0,
      net_profit REAL NOT NULL,
      dividend_percent REAL NOT NULL DEFAULT 50.0,
      dividend_pool REAL NOT NULL,
      eligible_shares INTEGER NOT NULL,
      dividend_per_share REAL NOT NULL,
      scheduled_for TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('SCHEDULED', 'DISTRIBUTED', 'CANCELLED')),
      notes TEXT,
      distributed_at TEXT,
      total_distributed REAL NOT NULL DEFAULT 0.0,
      shareholders_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (reporter_id) REFERENCES users(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS dividend_payouts (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      shares_count INTEGER NOT NULL,
      dividend_per_share REAL NOT NULL,
      payout_amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (report_id) REFERENCES earnings_reports(id),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS buybacks (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      founder_id TEXT NOT NULL,
      shares_count INTEGER NOT NULL,
      gold_spent REAL NOT NULL,
      avg_price REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (founder_id) REFERENCES users(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
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
  await db.execute({
    sql: `
    INSERT OR IGNORE INTO settings (key, value) VALUES
    ('tax_rate', '10'),
    ('iron_price', '5'),
    ('house_name', 'JosephArora'),
    ('api_key', ?),
    ('ipo_listing_fee', '200'),
    ('auto_approve_deposits', 'false');
  `,
    args: [crypto.randomBytes(24).toString("hex")],
  });

  // The old default webhook key is public (it was committed to the repo and the userscript): replace it
  await db.execute({
    sql: "UPDATE settings SET value = ? WHERE key = 'api_key' AND value = ?",
    args: [crypto.randomBytes(24).toString("hex"), LEAKED_API_KEY],
  });

  // Ensure Exchange Treasury user exists (trading and buyback fees are credited to it). It starts empty:
  // the seed no longer wipes admin purses on every cold start, so a starting balance would stay as
  // gold nobody deposited. Existing databases keep their current treasury row.
  await db.execute(`
    INSERT OR IGNORE INTO users (id, username, password_hash, display_name, parlamentum_name, cash_balance, locked_cash, avatar, is_admin, created_at)
    VALUES ('usr_treasury', 'ExchangeTreasury', 'none', 'Exchange Treasury', 'ExchangeTreasury', 0.0, 0.0, '🏛️', 1, '2026-01-01T00:00:00Z');
  `);

  isInitialized = true;
}
