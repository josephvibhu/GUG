import { getDb, initDb } from "./db";
import crypto from "crypto";

export interface Company {
  id: string;
  ticker: string;
  name: string;
  description: string;
  sector: string;
  creatorId: string;
  creatorName?: string;
  totalShares: number;
  floatShares: number;
  ipoPrice: number;
  currentPrice: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  marketCap: number;
  logoUrl: string;
  status: "ACTIVE" | "HALTED" | "DEFAULTED";
  sharesBoughtBack: number;
  buybackGoldSpent: number;
  createdAt: string;
}

export interface OrderLevel {
  price: number;
  quantity: number;
  orderCount: number;
  cumulativeTotal: number;
}

export interface OrderBookData {
  bids: OrderLevel[];
  asks: OrderLevel[];
  spread: number;
  spreadPercent: number;
  lastPrice: number;
}

export interface TradeItem {
  id: string;
  companyId: string;
  price: number;
  quantity: number;
  total: number;
  type: "BUY" | "SELL";
  timestamp: string;
}

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PortfolioPosition {
  companyId: string;
  ticker: string;
  name: string;
  shares: number;
  lockedShares: number;
  availableShares: number;
  avgBuyPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  pnl: number;
  pnlPercent: number;
}

export async function getAllCompanies(): Promise<Company[]> {
  await initDb();
  const db = getDb();

  const res = await db.execute(`
    SELECT c.*, u.display_name as creator_name 
    FROM companies c
    LEFT JOIN users u ON c.creator_id = u.id
    ORDER BY (c.current_price * c.total_shares) DESC
  `);

  return res.rows.map((row: any) => ({
    id: String(row.id),
    ticker: String(row.ticker),
    name: String(row.name),
    description: String(row.description),
    sector: String(row.sector),
    creatorId: String(row.creator_id),
    creatorName: String(row.creator_name || "Unknown"),
    totalShares: Number(row.total_shares),
    floatShares: Number(row.float_shares),
    ipoPrice: Number(row.ipo_price),
    currentPrice: Number(row.current_price),
    change24h: Number(row.change_24h),
    volume24h: Number(row.volume_24h),
    high24h: Number(row.high_24h),
    low24h: Number(row.low_24h),
    marketCap: Number(row.current_price) * Number(row.total_shares),
    logoUrl: String(row.logo_url || "🏢"),
    status: (row.status as any) || "ACTIVE",
    sharesBoughtBack: Number(row.shares_bought_back || 0),
    buybackGoldSpent: Number(row.buyback_gold_spent || 0),
    createdAt: String(row.created_at),
  }));
}

export async function getCompanyByTicker(ticker: string): Promise<Company | null> {
  await initDb();
  const db = getDb();

  const res = await db.execute({
    sql: `SELECT c.*, u.display_name as creator_name 
          FROM companies c 
          LEFT JOIN users u ON c.creator_id = u.id 
          WHERE UPPER(c.ticker) = UPPER(?) OR c.id = ?`,
    args: [ticker, ticker],
  });

  if (res.rows.length === 0) return null;
  const row = res.rows[0];

  return {
    id: String(row.id),
    ticker: String(row.ticker),
    name: String(row.name),
    description: String(row.description),
    sector: String(row.sector),
    creatorId: String(row.creator_id),
    creatorName: String(row.creator_name || "Unknown"),
    totalShares: Number(row.total_shares),
    floatShares: Number(row.float_shares),
    ipoPrice: Number(row.ipo_price),
    currentPrice: Number(row.current_price),
    change24h: Number(row.change_24h),
    volume24h: Number(row.volume_24h),
    high24h: Number(row.high_24h),
    low24h: Number(row.low_24h),
    marketCap: Number(row.current_price) * Number(row.total_shares),
    logoUrl: String(row.logo_url || "🏢"),
    status: (row.status as any) || "ACTIVE",
    sharesBoughtBack: Number(row.shares_bought_back || 0),
    buybackGoldSpent: Number(row.buyback_gold_spent || 0),
    createdAt: String(row.created_at),
  };
}

export async function getOrderBook(companyId: string): Promise<OrderBookData> {
  await initDb();
  const db = getDb();

  // Fetch Bids aggregated by price level (highest to lowest)
  const bidsRes = await db.execute({
    sql: `SELECT price, SUM(remaining_quantity) as total_qty, COUNT(*) as order_count 
          FROM orders 
          WHERE company_id = ? AND type = 'BUY' AND status IN ('OPEN', 'PARTIAL') 
          GROUP BY price 
          ORDER BY price DESC 
          LIMIT 15`,
    args: [companyId],
  });

  // Fetch Asks aggregated by price level (lowest to highest)
  const asksRes = await db.execute({
    sql: `SELECT price, SUM(remaining_quantity) as total_qty, COUNT(*) as order_count 
          FROM orders 
          WHERE company_id = ? AND type = 'SELL' AND status IN ('OPEN', 'PARTIAL') 
          GROUP BY price 
          ORDER BY price ASC 
          LIMIT 15`,
    args: [companyId],
  });

  let bidCum = 0;
  const bids: OrderLevel[] = bidsRes.rows.map((r: any) => {
    const qty = Number(r.total_qty);
    bidCum += qty;
    return {
      price: Number(r.price),
      quantity: qty,
      orderCount: Number(r.order_count),
      cumulativeTotal: bidCum,
    };
  });

  let askCum = 0;
  const asks: OrderLevel[] = asksRes.rows.map((r: any) => {
    const qty = Number(r.total_qty);
    askCum += qty;
    return {
      price: Number(r.price),
      quantity: qty,
      orderCount: Number(r.order_count),
      cumulativeTotal: askCum,
    };
  });

  // Fetch last trade price or current price
  const compRes = await db.execute({
    sql: "SELECT current_price FROM companies WHERE id = ?",
    args: [companyId],
  });
  const lastPrice = compRes.rows.length > 0 ? Number(compRes.rows[0].current_price) : 0;

  const highestBid = bids.length > 0 ? bids[0].price : lastPrice;
  const lowestAsk = asks.length > 0 ? asks[0].price : lastPrice;
  const spread = Math.max(0, Math.round((lowestAsk - highestBid) * 100) / 100);
  const spreadPercent = lowestAsk > 0 ? Math.round((spread / lowestAsk) * 10000) / 100 : 0;

  return {
    bids,
    asks,
    spread,
    spreadPercent,
    lastPrice,
  };
}

export async function getRecentTrades(companyId: string, limit = 20): Promise<TradeItem[]> {
  await initDb();
  const db = getDb();

  const res = await db.execute({
    sql: `SELECT t.*, 
            CASE WHEN o.type IS NOT NULL THEN o.type ELSE 'BUY' END as side
          FROM trades t
          LEFT JOIN orders o ON t.buy_order_id = o.id
          WHERE t.company_id = ?
          ORDER BY t.created_at DESC
          LIMIT ?`,
    args: [companyId, limit],
  });

  return res.rows.map((r: any) => ({
    id: String(r.id),
    companyId: String(r.company_id),
    price: Number(r.price),
    quantity: Number(r.quantity),
    total: Number(r.total),
    type: r.side === "SELL" ? "SELL" : "BUY",
    timestamp: String(r.created_at),
  }));
}

export async function getCandles(companyId: string): Promise<CandleData[]> {
  await initDb();
  const db = getDb();

  const res = await db.execute({
    sql: `SELECT * FROM candles 
          WHERE company_id = ? 
          ORDER BY time_bucket ASC 
          LIMIT 50`,
    args: [companyId],
  });

  return res.rows.map((r: any) => ({
    time: String(r.time_bucket),
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: Number(r.volume),
  }));
}

export async function getUserPortfolio(userId: string): Promise<{ positions: PortfolioPosition[]; totalNetWorth: number; totalStockValue: number; cashBalance: number; lockedCash: number }> {
  await initDb();
  const db = getDb();

  const userRes = await db.execute({
    sql: "SELECT cash_balance, locked_cash FROM users WHERE id = ?",
    args: [userId],
  });
  const cashBalance = userRes.rows.length > 0 ? Number(userRes.rows[0].cash_balance) : 0;
  const lockedCash = userRes.rows.length > 0 ? Number(userRes.rows[0].locked_cash) : 0;

  const res = await db.execute({
    sql: `SELECT p.*, c.ticker, c.name, c.current_price 
          FROM portfolios p
          JOIN companies c ON p.company_id = c.id
          WHERE p.user_id = ? AND (p.shares > 0 OR p.locked_shares > 0)
          ORDER BY (p.shares * c.current_price) DESC`,
    args: [userId],
  });

  let totalStockValue = 0;
  const positions: PortfolioPosition[] = res.rows.map((r: any) => {
    const shares = Number(r.shares);
    const lockedShares = Number(r.locked_shares);
    const availableShares = shares - lockedShares;
    const avgBuyPrice = Number(r.avg_buy_price);
    const currentPrice = Number(r.current_price);
    const marketValue = Math.round(shares * currentPrice * 100) / 100;
    const costBasis = Math.round(shares * avgBuyPrice * 100) / 100;
    const pnl = Math.round((marketValue - costBasis) * 100) / 100;
    const pnlPercent = costBasis > 0 ? Math.round(((marketValue - costBasis) / costBasis) * 10000) / 100 : 0;

    totalStockValue += marketValue;

    return {
      companyId: String(r.company_id),
      ticker: String(r.ticker),
      name: String(r.name),
      shares,
      lockedShares,
      availableShares,
      avgBuyPrice,
      currentPrice,
      marketValue,
      costBasis,
      pnl,
      pnlPercent,
    };
  });

  const totalNetWorth = Math.round((cashBalance + lockedCash + totalStockValue) * 100) / 100;

  return {
    positions,
    totalNetWorth,
    totalStockValue: Math.round(totalStockValue * 100) / 100,
    cashBalance,
    lockedCash,
  };
}

export async function getUserOrders(userId: string, companyId?: string): Promise<any[]> {
  await initDb();
  const db = getDb();

  let query = `
    SELECT o.*, c.ticker, c.name as company_name 
    FROM orders o
    JOIN companies c ON o.company_id = c.id
    WHERE o.user_id = ? AND o.status IN ('OPEN', 'PARTIAL')
  `;
  const args: any[] = [userId];

  if (companyId) {
    query += " AND o.company_id = ?";
    args.push(companyId);
  }

  query += " ORDER BY o.created_at DESC";

  const res = await db.execute({ sql: query, args });
  return res.rows.map((r: any) => ({
    id: String(r.id),
    companyId: String(r.company_id),
    ticker: String(r.ticker),
    companyName: String(r.company_name),
    type: String(r.type),
    orderType: String(r.order_type),
    price: Number(r.price),
    initialQuantity: Number(r.initial_quantity),
    remainingQuantity: Number(r.remaining_quantity),
    filledQuantity: Number(r.initial_quantity) - Number(r.remaining_quantity),
    status: String(r.status),
    createdAt: String(r.created_at),
  }));
}

export async function createCompanyIPO(params: {
  creatorId: string;
  ticker: string;
  name: string;
  description: string;
  sector: string;
  totalShares: number;
  ipoPrice: number;
  founderRetainPercent: number; // e.g. 50%
  logoUrl?: string;
}): Promise<{ success: boolean; message?: string; company?: Company }> {
  await initDb();
  const db = getDb();

  const ticker = params.ticker.trim().toUpperCase();
  if (ticker.length < 2 || ticker.length > 5) {
    return { success: false, message: "Ticker must be between 2 and 5 uppercase characters" };
  }

  const existing = await db.execute({
    sql: "SELECT id FROM companies WHERE UPPER(ticker) = ?",
    args: [ticker],
  });
  if (existing.rows.length > 0) {
    return { success: false, message: `Ticker symbol $${ticker} is already registered on the exchange!` };
  }

  const totalShares = Math.max(1000, Math.floor(params.totalShares));
  const ipoPrice = Math.max(0.1, Math.round(params.ipoPrice * 100) / 100);
  const founderPercent = Math.min(99.9, Math.max(0.1, Math.round(params.founderRetainPercent * 100) / 100));
  
  const rawFounderShares = Math.floor(totalShares * (founderPercent / 100));
  const floatShares = Math.max(1, totalShares - rawFounderShares);
  const founderShares = totalShares - floatShares;

  const companyId = `cmp_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO companies (id, ticker, name, description, sector, creator_id, total_shares, float_shares, ipo_price, current_price, change_24h, volume_24h, high_24h, low_24h, logo_url, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, 0.0, ?, ?, ?, ?)`,
    args: [
      companyId,
      ticker,
      params.name,
      params.description,
      params.sector,
      params.creatorId,
      totalShares,
      floatShares,
      ipoPrice,
      ipoPrice,
      ipoPrice,
      ipoPrice,
      params.logoUrl || "🏛️",
      now,
    ],
  });

  // Assign founder shares to creator
  await db.execute({
    sql: `INSERT INTO portfolios (id, user_id, company_id, shares, locked_shares, avg_buy_price)
          VALUES (?, ?, ?, ?, 0, ?)`,
    args: [`port_${params.creatorId}_${ticker}`, params.creatorId, companyId, founderShares, ipoPrice],
  });

  // Assign float shares to Treasury / Market Maker Bot and post initial IPO sell orders on the book!
  const botShares = floatShares;
  await db.execute({
    sql: `INSERT INTO portfolios (id, user_id, company_id, shares, locked_shares, avg_buy_price)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [`port_treasury_${ticker}`, "usr_treasury", companyId, botShares, botShares, ipoPrice],
  });

  // Place Primary IPO Offering orders on the book
  const orderId = `ord_ipo_${companyId}`;
  await db.execute({
    sql: `INSERT INTO orders (id, user_id, company_id, type, order_type, price, initial_quantity, remaining_quantity, status, created_at)
          VALUES (?, 'usr_treasury', ?, 'SELL', 'LIMIT', ?, ?, ?, 'OPEN', ?)`,
    args: [orderId, companyId, ipoPrice, botShares, botShares, now],
  });

  // Initial candlestick
  const currentHourBucket = now.slice(0, 13) + ":00:00Z";
  await db.execute({
    sql: `INSERT INTO candles (id, company_id, time_bucket, open, high, low, close, volume)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    args: [`cnd_${companyId}_init`, companyId, currentHourBucket, ipoPrice, ipoPrice, ipoPrice, ipoPrice],
  });

  // Official announcement
  await db.execute({
    sql: `INSERT INTO announcements (id, company_id, title, content, author_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      `anc_${companyId}_0`,
      companyId,
      `Official IPO Filing: $${ticker} (${params.name})`,
      `The High Registrar of Parlamentum formally inaugurates $${ticker}. ${floatShares.toLocaleString()} primary shares are now released for public subscription at Ᵽ${ipoPrice.toFixed(2)} per share.`,
      params.creatorId,
      now,
    ],
  });

  const company = await getCompanyByTicker(ticker);
  return { success: true, company: company! };
}

export interface IPOApplication {
  id: string;
  userId: string;
  parlamentumName: string;
  ticker: string;
  name: string;
  description: string;
  sector: string;
  proposedTotalShares: number;
  proposedIpoPrice: number;
  proposedFounderRetainPercent: number;
  logoUrl: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  operatorNotes?: string;
  finalPrice?: number;
  createdAt: string;
}

export async function submitIPOApplication(params: {
  userId: string;
  parlamentumName: string;
  ticker: string;
  name: string;
  description: string;
  sector: string;
  proposedTotalShares: number;
  proposedIpoPrice: number;
  proposedFounderRetainPercent: number;
  logoUrl?: string;
}): Promise<{ success: boolean; message: string; applicationId?: string }> {
  await initDb();
  const db = getDb();

  const ticker = params.ticker.trim().toUpperCase();
  if (ticker.length < 2 || ticker.length > 5) {
    return { success: false, message: "Ticker symbol must be 2 to 5 characters" };
  }

  // Check if ticker already exists as active company
  const existingCompany = await db.execute({
    sql: "SELECT id FROM companies WHERE UPPER(ticker) = ?",
    args: [ticker],
  });
  if (existingCompany.rows.length > 0) {
    return { success: false, message: `Ticker $${ticker} is already registered on the exchange!` };
  }

  // Check if ticker is already pending review
  const existingApp = await db.execute({
    sql: "SELECT id FROM ipo_applications WHERE UPPER(ticker) = ? AND status = 'PENDING'",
    args: [ticker],
  });
  if (existingApp.rows.length > 0) {
    return { success: false, message: `An IPO application for $${ticker} is already pending operator review!` };
  }

  const appId = `ipo_app_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO ipo_applications (id, user_id, parlamentum_name, ticker, name, description, sector, proposed_total_shares, proposed_ipo_price, proposed_founder_retain_percent, logo_url, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
    args: [
      appId,
      params.userId,
      params.parlamentumName,
      ticker,
      params.name.trim(),
      params.description.trim(),
      params.sector.trim(),
      Math.max(1000, Math.floor(params.proposedTotalShares)),
      Math.max(0.1, Math.round(params.proposedIpoPrice * 100) / 100),
      Math.min(99.9, Math.max(0.1, Math.round(params.proposedFounderRetainPercent * 100) / 100)),
      params.logoUrl || "🏛️",
      now,
    ],
  });

  return {
    success: true,
    message: "IPO charter request submitted! The High Registrar will review your prospectus, business lore, and negotiate your initial listing price.",
    applicationId: appId,
  };
}

export async function getIPOApplications(status?: string): Promise<IPOApplication[]> {
  await initDb();
  const db = getDb();

  const query = status
    ? `SELECT * FROM ipo_applications WHERE status = ? ORDER BY created_at DESC`
    : `SELECT * FROM ipo_applications ORDER BY created_at DESC`;
  const args = status ? [status] : [];

  const res = await db.execute({ sql: query, args });

  return res.rows.map((r: any) => ({
    id: String(r.id),
    userId: String(r.user_id),
    parlamentumName: String(r.parlamentum_name),
    ticker: String(r.ticker),
    name: String(r.name),
    description: String(r.description),
    sector: String(r.sector),
    proposedTotalShares: Number(r.proposed_total_shares),
    proposedIpoPrice: Number(r.proposed_ipo_price),
    proposedFounderRetainPercent: Number(r.proposed_founder_retain_percent),
    logoUrl: String(r.logo_url || "🏛️"),
    status: r.status as any,
    operatorNotes: r.operator_notes ? String(r.operator_notes) : undefined,
    finalPrice: r.final_price ? Number(r.final_price) : undefined,
    createdAt: String(r.created_at),
  }));
}

export async function getUserIPOApplications(userId: string): Promise<IPOApplication[]> {
  await initDb();
  const db = getDb();

  const res = await db.execute({
    sql: `SELECT * FROM ipo_applications WHERE user_id = ? ORDER BY created_at DESC`,
    args: [userId],
  });

  return res.rows.map((r: any) => ({
    id: String(r.id),
    userId: String(r.user_id),
    parlamentumName: String(r.parlamentum_name),
    ticker: String(r.ticker),
    name: String(r.name),
    description: String(r.description),
    sector: String(r.sector),
    proposedTotalShares: Number(r.proposed_total_shares),
    proposedIpoPrice: Number(r.proposed_ipo_price),
    proposedFounderRetainPercent: Number(r.proposed_founder_retain_percent),
    logoUrl: String(r.logo_url || "🏛️"),
    status: r.status as any,
    operatorNotes: r.operator_notes ? String(r.operator_notes) : undefined,
    finalPrice: r.final_price ? Number(r.final_price) : undefined,
    createdAt: String(r.created_at),
  }));
}

export async function approveAndListIPO(
  appId: string, 
  negotiatedPrice?: number, 
  negotiatedShares?: number,
  negotiatedFounderRetainPercent?: number,
  operatorNotes?: string
): Promise<{ success: boolean; message: string; company?: Company }> {
  await initDb();
  const db = getDb();

  const appRes = await db.execute({
    sql: "SELECT * FROM ipo_applications WHERE id = ?",
    args: [appId],
  });

  if (appRes.rows.length === 0) {
    return { success: false, message: "IPO application not found" };
  }

  const app = appRes.rows[0];
  const finalPrice = negotiatedPrice !== undefined && negotiatedPrice > 0 ? negotiatedPrice : Number(app.proposed_ipo_price);
  const finalShares = negotiatedShares !== undefined && negotiatedShares >= 1000 ? negotiatedShares : Number(app.proposed_total_shares);
  const finalFounderRetain = (negotiatedFounderRetainPercent !== undefined && negotiatedFounderRetainPercent >= 0.1 && negotiatedFounderRetainPercent <= 99.9)
    ? Math.round(negotiatedFounderRetainPercent * 100) / 100
    : Number(app.proposed_founder_retain_percent);

  // Officially list the company on the floor
  const listRes = await createCompanyIPO({
    creatorId: String(app.user_id),
    ticker: String(app.ticker),
    name: String(app.name),
    description: String(app.description),
    sector: String(app.sector),
    totalShares: finalShares,
    ipoPrice: finalPrice,
    founderRetainPercent: finalFounderRetain,
    logoUrl: String(app.logo_url || "🏛️"),
  });

  if (!listRes.success) {
    return { success: false, message: listRes.message || "Failed to list company" };
  }

  // Update application status
  await db.execute({
    sql: `UPDATE ipo_applications SET status = 'APPROVED', final_price = ?, operator_notes = ? WHERE id = ?`,
    args: [finalPrice, operatorNotes || "Charter approved and listed on exchange", appId],
  });

  return {
    success: true,
    message: `Successfully approved and listed $${app.ticker} at negotiated price of ${finalPrice.toFixed(2)} gold!`,
    company: listRes.company,
  };
}

export async function rejectIPOApplication(appId: string, reason: string): Promise<{ success: boolean; message: string }> {
  await initDb();
  const db = getDb();

  await db.execute({
    sql: `UPDATE ipo_applications SET status = 'REJECTED', operator_notes = ? WHERE id = ?`,
    args: [reason || "Application rejected by exchange operator", appId],
  });

  return { success: true, message: "IPO application rejected." };
}

export async function executeShareBuyback(params: {
  founderId: string;
  ticker: string;
  goldToSpend: number;
}): Promise<{ success: boolean; message: string; sharesAcquired?: number; avgPrice?: number; totalSpent?: number }> {
  await initDb();
  const db = getDb();

  const goldToSpend = Math.round(params.goldToSpend * 100) / 100;
  if (goldToSpend < 10) {
    return { success: false, message: "Minimum buyback allocation is 10 gold." };
  }

  // 1. Fetch founder user
  const userRes = await db.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [params.founderId],
  });
  if (userRes.rows.length === 0) {
    return { success: false, message: "User not found" };
  }
  const user = userRes.rows[0];
  if (Number(user.is_frozen || 0) === 1) {
    return { success: false, message: "Your wallet is frozen by the operator." };
  }
  if (Number(user.cash_balance) < goldToSpend) {
    return { 
      success: false, 
      message: `Insufficient gold balance. You have ${Number(user.cash_balance).toFixed(2)} gold, requested ${goldToSpend.toFixed(2)} gold.` 
    };
  }

  // 2. Fetch company
  const compRes = await db.execute({
    sql: "SELECT * FROM companies WHERE UPPER(ticker) = UPPER(?)",
    args: [params.ticker],
  });
  if (compRes.rows.length === 0) {
    return { success: false, message: "Company not found" };
  }
  const company = compRes.rows[0];
  if (String(company.creator_id) !== params.founderId && Number(user.is_admin) !== 1) {
    return { success: false, message: "Only the company founder (or operator) can initiate a corporate share buyback." };
  }
  if (company.status === "HALTED" || company.status === "DEFAULTED") {
    return { success: false, message: `Company trading is ${company.status}. Buyback suspended.` };
  }

  const companyId = String(company.id);

  // 3. Find open SELL orders on the book, lowest price first
  const sellOrdersRes = await db.execute({
    sql: `SELECT * FROM orders 
          WHERE company_id = ? AND type = 'SELL' AND status IN ('OPEN', 'PARTIAL') AND remaining_quantity > 0
          ORDER BY price ASC, created_at ASC`,
    args: [companyId],
  });

  if (sellOrdersRes.rows.length === 0) {
    return { success: false, message: `No open sell orders available on the book for $${company.ticker} to buy back.` };
  }

  let remainingGold = goldToSpend;
  let totalSharesAcquired = 0;
  let totalGoldSpent = 0;
  let lastFillPrice = Number(company.current_price);
  const now = new Date().toISOString();

  for (const row of sellOrdersRes.rows) {
    if (remainingGold <= 0) break;
    const orderId = String(row.id);
    const sellerId = String(row.user_id);
    const askPrice = Number(row.price);
    const remainingQty = Number(row.remaining_quantity);

    const maxSharesAffordable = Math.floor(remainingGold / askPrice);
    if (maxSharesAffordable <= 0) break;

    const fillQty = Math.min(remainingQty, maxSharesAffordable);
    const cost = Math.round(fillQty * askPrice * 100) / 100;

    remainingGold -= cost;
    totalGoldSpent += cost;
    totalSharesAcquired += fillQty;
    lastFillPrice = askPrice;

    const newRemaining = remainingQty - fillQty;
    const newStatus = newRemaining === 0 ? "FILLED" : "PARTIAL";
    await db.execute({
      sql: "UPDATE orders SET remaining_quantity = ?, status = ? WHERE id = ?",
      args: [newRemaining, newStatus, orderId],
    });

    const fee = Math.round(cost * 0.005 * 100) / 100;
    const netSellerProceeds = cost - fee;

    await db.execute({
      sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
      args: [netSellerProceeds, sellerId],
    });

    if (fee > 0) {
      await db.execute({
        sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = 'usr_treasury'",
        args: [fee],
      });
    }

    const tradeId = `trd_bb_${crypto.randomUUID().slice(0, 8)}`;
    await db.execute({
      sql: `INSERT INTO trades (id, company_id, buyer_id, seller_id, buy_order_id, sell_order_id, price, quantity, total, created_at)
            VALUES (?, ?, ?, ?, 'BUYBACK', ?, ?, ?, ?, ?)`,
      args: [tradeId, companyId, params.founderId, sellerId, orderId, askPrice, fillQty, cost, now],
    });
  }

  if (totalSharesAcquired === 0) {
    return { 
      success: false, 
      message: `Could not buy any shares. Lowest ask price is higher than allocated gold (${goldToSpend}g).` 
    };
  }

  // Deduct actual total spent from founder's purse
  await db.execute({
    sql: "UPDATE users SET cash_balance = cash_balance - ? WHERE id = ?",
    args: [totalGoldSpent, params.founderId],
  });

  // Update company metrics (retire shares, update price)
  await db.execute({
    sql: `UPDATE companies 
          SET shares_bought_back = shares_bought_back + ?, 
              buyback_gold_spent = buyback_gold_spent + ?,
              float_shares = MAX(0, float_shares - ?),
              current_price = ?,
              high_24h = MAX(high_24h, ?),
              low_24h = MIN(low_24h, ?)
          WHERE id = ?`,
    args: [totalSharesAcquired, totalGoldSpent, totalSharesAcquired, lastFillPrice, lastFillPrice, lastFillPrice, companyId],
  });

  const avgPrice = Math.round((totalGoldSpent / totalSharesAcquired) * 100) / 100;
  const buybackId = `bb_${crypto.randomUUID().slice(0, 8)}`;

  await db.execute({
    sql: `INSERT INTO buybacks (id, company_id, founder_id, shares_count, gold_spent, avg_price, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [buybackId, companyId, params.founderId, totalSharesAcquired, totalGoldSpent, avgPrice, now],
  });

  await db.execute({
    sql: `INSERT INTO announcements (id, company_id, title, content, author_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      `ann_bb_${buybackId}`,
      companyId,
      `📢 SHARE BUYBACK: ${totalSharesAcquired.toLocaleString()} shares redeemed!`,
      `Founder ${user.display_name} has completed a corporate share buyback, purchasing ${totalSharesAcquired.toLocaleString()} shares from the open market for a total of ${totalGoldSpent.toLocaleString()} gold (avg price: ${avgPrice.toFixed(2)}g). These shares are retired from circulation, reducing public float.`,
      params.founderId,
      now,
    ],
  });

  return {
    success: true,
    message: `Share buyback successful! Purchased ${totalSharesAcquired.toLocaleString()} shares for ${totalGoldSpent.toLocaleString()} gold (avg price ${avgPrice.toFixed(2)}g).`,
    sharesAcquired: totalSharesAcquired,
    avgPrice,
    totalSpent: totalGoldSpent,
  };
}

