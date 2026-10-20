import { getDb, initDb, scheduleBlobPersist } from "./db";
import { getSetting } from "./wallet";
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
  totalDividendsPaid?: number;
  weeklyRevenue?: number;
  treasuryBalance?: number;
  totalProfitDeposited?: number;
  ipoFeeCollected?: number;
  sharesSold?: number;
  sharesRemaining?: number;
  secondaryAsks?: number;
  minSecondaryPrice?: number | null;
  maxSecondaryPrice?: number | null;
  totalActiveAsks?: number;
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
  creatorId?: string;
  isCreator?: boolean;
  totalCompanyShares?: number;
  floatShares?: number;
  ownershipPercent?: number;
  ipoFeeCollected?: number;
  // Founder positions only: gold held in the company's treasury
  treasuryBalance?: number;
}

interface DayStats {
  high: number;
  low: number;
  volume: number; // gold traded
  prevClose: number | null; // last price before the 24h window
}

// Real 24h figures from the trades table. The change_24h / volume_24h / high_24h / low_24h columns
// are never reset (change is even measured against the IPO price), so they can't be shown as "24h".
async function getDayStats(companyId?: string): Promise<Record<string, DayStats>> {
  const db = getDb();
  const since = new Date(Date.now() - 86400000).toISOString();
  const only = companyId ? " AND company_id = ?" : "";
  const args = companyId ? [since, companyId] : [since];
  const [windowRes, prevRes] = await Promise.all([
    db.execute({
      sql: `SELECT company_id, MIN(price) AS lo, MAX(price) AS hi, SUM(total) AS vol
            FROM trades WHERE created_at >= ?${only} GROUP BY company_id`,
      args,
    }),
    db.execute({
      sql: `SELECT t.company_id, t.price FROM trades t
            JOIN (SELECT company_id, MAX(created_at) AS mx FROM trades WHERE created_at < ?${only} GROUP BY company_id) m
              ON t.company_id = m.company_id AND t.created_at = m.mx`,
      args,
    }),
  ]);
  const stats: Record<string, DayStats> = {};
  for (const r of windowRes.rows as any[]) {
    stats[String(r.company_id)] = { high: Number(r.hi), low: Number(r.lo), volume: Number(r.vol), prevClose: null };
  }
  for (const r of prevRes.rows as any[]) {
    const cid = String(r.company_id);
    stats[cid] = { ...(stats[cid] || { high: NaN, low: NaN, volume: 0 }), prevClose: Number(r.price) };
  }
  return stats;
}

function withDayStats(company: Company, s: DayStats | undefined): Company {
  const cur = company.currentPrice;
  const ref = s?.prevClose ?? company.ipoPrice; // no earlier trade: compare with the listing price
  return {
    ...company,
    change24h: ref > 0 ? Math.round(((cur - ref) / ref) * 10000) / 100 : 0,
    high24h: s && Number.isFinite(s.high) ? s.high : cur,
    low24h: s && Number.isFinite(s.low) ? s.low : cur,
    volume24h: s ? Math.round(s.volume * 100) / 100 : 0,
  };
}

export async function getAllCompanies(): Promise<Company[]> {
  await initDb();
  const db = getDb();

  const [res, dayStats] = await Promise.all([
    db.execute(`
      SELECT c.*, u.display_name as creator_name,
             o.initial_quantity as ipo_initial,
             o.remaining_quantity as ipo_remaining,
             o.status as ipo_status,
             (
               SELECT COALESCE(SUM(s.remaining_quantity), 0)
               FROM orders s
               WHERE s.company_id = c.id
                 AND s.type = 'SELL'
                 AND s.status IN ('OPEN', 'PARTIAL')
                 AND s.id != ('ord_ipo_' || c.id)
             ) as secondary_asks,
             (
               SELECT MIN(s.price)
               FROM orders s
               WHERE s.company_id = c.id
                 AND s.type = 'SELL'
                 AND s.status IN ('OPEN', 'PARTIAL')
                 AND s.id != ('ord_ipo_' || c.id)
             ) as min_secondary_price,
             (
               SELECT MAX(s.price)
               FROM orders s
               WHERE s.company_id = c.id
                 AND s.type = 'SELL'
                 AND s.status IN ('OPEN', 'PARTIAL')
                 AND s.id != ('ord_ipo_' || c.id)
             ) as max_secondary_price,
             (
               SELECT COALESCE(SUM(s.remaining_quantity), 0)
               FROM orders s
               WHERE s.company_id = c.id
                 AND s.type = 'SELL'
                 AND s.status IN ('OPEN', 'PARTIAL')
             ) as total_active_asks
      FROM companies c
      LEFT JOIN users u ON c.creator_id = u.id
      LEFT JOIN orders o ON o.id = 'ord_ipo_' || c.id
      ORDER BY (c.current_price * c.total_shares) DESC
    `),
    getDayStats(),
  ]);

  return res.rows.map((row: any) => {
    const floatListed = Number(row.ipo_initial ?? row.float_shares ?? 0);
    const sharesRemaining = row.ipo_remaining !== null && row.ipo_remaining !== undefined ? Number(row.ipo_remaining) : 0;
    const sharesSold = Math.max(0, floatListed - sharesRemaining);

    return withDayStats({
      id: String(row.id),
      ticker: String(row.ticker),
      name: String(row.name),
      description: String(row.description),
      sector: String(row.sector),
      creatorId: String(row.creator_id),
      creatorName: String(row.creator_name || "Unknown"),
      totalShares: Number(row.total_shares),
      floatShares: floatListed,
      sharesSold,
      sharesRemaining,
      secondaryAsks: Number(row.secondary_asks || 0),
      minSecondaryPrice: row.min_secondary_price !== null && row.min_secondary_price !== undefined ? Number(row.min_secondary_price) : null,
      maxSecondaryPrice: row.max_secondary_price !== null && row.max_secondary_price !== undefined ? Number(row.max_secondary_price) : null,
      totalActiveAsks: Number(row.total_active_asks || 0),
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
      totalDividendsPaid: Number(row.total_dividends_paid || 0),
      weeklyRevenue: Number(row.weekly_revenue || 0),
      treasuryBalance: Number(row.treasury_balance || 0),
      totalProfitDeposited: Number(row.total_profit_deposited || 0),
      ipoFeeCollected: Number(row.ipo_fee_collected || 0),
      createdAt: String(row.created_at),
    }, dayStats[String(row.id)]);
  });
}

export async function getCompanyByTicker(ticker: string): Promise<Company | null> {
  await initDb();
  const db = getDb();

  const res = await db.execute({
    sql: `SELECT c.*, u.display_name as creator_name,
                 o.initial_quantity as ipo_initial,
                 o.remaining_quantity as ipo_remaining,
                 o.status as ipo_status,
             (
               SELECT COALESCE(SUM(s.remaining_quantity), 0)
               FROM orders s
               WHERE s.company_id = c.id
                 AND s.type = 'SELL'
                 AND s.status IN ('OPEN', 'PARTIAL')
                 AND s.id != ('ord_ipo_' || c.id)
             ) as secondary_asks,
             (
               SELECT MIN(s.price)
               FROM orders s
               WHERE s.company_id = c.id
                 AND s.type = 'SELL'
                 AND s.status IN ('OPEN', 'PARTIAL')
                 AND s.id != ('ord_ipo_' || c.id)
             ) as min_secondary_price,
             (
               SELECT MAX(s.price)
               FROM orders s
               WHERE s.company_id = c.id
                 AND s.type = 'SELL'
                 AND s.status IN ('OPEN', 'PARTIAL')
                 AND s.id != ('ord_ipo_' || c.id)
             ) as max_secondary_price,
             (
               SELECT COALESCE(SUM(s.remaining_quantity), 0)
               FROM orders s
               WHERE s.company_id = c.id
                 AND s.type = 'SELL'
                 AND s.status IN ('OPEN', 'PARTIAL')
             ) as total_active_asks
          FROM companies c 
          LEFT JOIN users u ON c.creator_id = u.id 
          LEFT JOIN orders o ON o.id = 'ord_ipo_' || c.id
          WHERE UPPER(c.ticker) = UPPER(?) OR c.id = ?`,
    args: [ticker, ticker],
  });

  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  const dayStats = await getDayStats(String(row.id));

  const floatListed = Number(row.ipo_initial ?? row.float_shares ?? 0);
  const sharesRemaining = row.ipo_remaining !== null && row.ipo_remaining !== undefined ? Number(row.ipo_remaining) : 0;
  const sharesSold = Math.max(0, floatListed - sharesRemaining);

  return withDayStats({
    id: String(row.id),
    ticker: String(row.ticker),
    name: String(row.name),
    description: String(row.description),
    sector: String(row.sector),
    creatorId: String(row.creator_id),
    creatorName: String(row.creator_name || "Unknown"),
    totalShares: Number(row.total_shares),
    floatShares: floatListed,
    sharesSold,
    sharesRemaining,
    secondaryAsks: Number(row.secondary_asks || 0),
    minSecondaryPrice: row.min_secondary_price !== null && row.min_secondary_price !== undefined ? Number(row.min_secondary_price) : null,
    maxSecondaryPrice: row.max_secondary_price !== null && row.max_secondary_price !== undefined ? Number(row.max_secondary_price) : null,
    totalActiveAsks: Number(row.total_active_asks || 0),
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
    totalDividendsPaid: Number(row.total_dividends_paid || 0),
    weeklyRevenue: Number(row.weekly_revenue || 0),
    treasuryBalance: Number(row.treasury_balance || 0),
    totalProfitDeposited: Number(row.total_profit_deposited || 0),
    ipoFeeCollected: Number(row.ipo_fee_collected || 0),
    createdAt: String(row.created_at),
  }, dayStats[String(row.id)]);
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

  // Side = the aggressor. The resting (maker) order was created before the trade; the taker's order row,
  // if any, carries the trade's own timestamp. Joining on buy_order_id alone made every trade a "BUY".
  const res = await db.execute({
    sql: `SELECT t.*,
            CASE
              WHEN so.created_at IS NOT NULL AND so.created_at < t.created_at THEN 'BUY'
              WHEN bo.created_at IS NOT NULL AND bo.created_at < t.created_at THEN 'SELL'
              ELSE 'BUY'
            END as side
          FROM trades t
          LEFT JOIN orders so ON t.sell_order_id = so.id
          LEFT JOIN orders bo ON t.buy_order_id = bo.id
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

// Chart intervals: candles are built from the trades table, so any resolution works (the hourly
// candles table only has hours that traded). Lookback keeps each response to a few hundred bars.
export const CANDLE_INTERVALS: Record<string, { seconds: number; lookbackDays: number }> = {
  "1m": { seconds: 60, lookbackDays: 3 },
  "5m": { seconds: 300, lookbackDays: 10 },
  "15m": { seconds: 900, lookbackDays: 30 },
  "1h": { seconds: 3600, lookbackDays: 120 },
  "4h": { seconds: 14400, lookbackDays: 365 },
  "1D": { seconds: 86400, lookbackDays: 1825 },
};

export interface OhlcvBar {
  time: number; // bucket start, unix seconds UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // shares
}

export async function getTradeCandles(companyId: string, interval: string): Promise<OhlcvBar[]> {
  await initDb();
  const db = getDb();
  const spec = CANDLE_INTERVALS[interval] || CANDLE_INTERVALS["1h"];
  const since = new Date(Date.now() - spec.lookbackDays * 86400000).toISOString();

  const res = await db.execute({
    sql: `SELECT price, quantity, created_at FROM trades
          WHERE company_id = ? AND created_at >= ?
          ORDER BY created_at DESC, rowid DESC
          LIMIT 50000`,
    args: [companyId, since],
  });

  const bars: OhlcvBar[] = [];
  for (let i = res.rows.length - 1; i >= 0; i--) {
    const r: any = res.rows[i];
    const price = Number(r.price);
    const qty = Number(r.quantity);
    const t = Math.floor(Date.parse(String(r.created_at)) / 1000 / spec.seconds) * spec.seconds;
    const last = bars[bars.length - 1];
    if (last && last.time === t) {
      last.high = Math.max(last.high, price);
      last.low = Math.min(last.low, price);
      last.close = price;
      last.volume += qty;
    } else {
      bars.push({ time: t, open: price, high: price, low: price, close: price, volume: qty });
    }
  }
  return bars.slice(-1500);
}

// Daily closes for the last two weeks per company (market list sparklines); cached for a minute
let sparklineCache: { at: number; data: Record<string, number[]> } | null = null;

export async function getSparklines(): Promise<Record<string, number[]>> {
  if (sparklineCache && Date.now() - sparklineCache.at < 60000) return sparklineCache.data;
  await initDb();
  const db = getDb();
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const res = await db.execute({
    sql: `SELECT company_id, substr(created_at, 1, 10) AS day, price FROM trades
          WHERE created_at >= ? ORDER BY created_at ASC, rowid ASC`,
    args: [since],
  });
  const byCompany: Record<string, Map<string, number>> = {};
  for (const r of res.rows as any[]) {
    const cid = String(r.company_id);
    (byCompany[cid] ??= new Map()).set(String(r.day), Number(r.price));
  }
  const data: Record<string, number[]> = {};
  for (const [cid, days] of Object.entries(byCompany)) data[cid] = [...days.values()];
  sparklineCache = { at: Date.now(), data };
  return data;
}

// One position (instead of loading the whole portfolio to find it)
export async function getUserHolding(userId: string, companyId: string): Promise<PortfolioPosition | null> {
  await initDb();
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT p.*, c.ticker, c.name, c.current_price
          FROM portfolios p JOIN companies c ON p.company_id = c.id
          WHERE p.user_id = ? AND p.company_id = ? AND (p.shares > 0 OR p.locked_shares > 0)`,
    args: [userId, companyId],
  });
  if (res.rows.length === 0) return null;
  const r: any = res.rows[0];
  const shares = Number(r.shares);
  const lockedShares = Number(r.locked_shares);
  const avgBuyPrice = Number(r.avg_buy_price);
  const currentPrice = Number(r.current_price);
  const marketValue = Math.round(shares * currentPrice * 100) / 100;
  const costBasis = Math.round(shares * avgBuyPrice * 100) / 100;
  return {
    companyId: String(r.company_id),
    ticker: String(r.ticker),
    name: String(r.name),
    shares,
    lockedShares,
    availableShares: shares - lockedShares,
    avgBuyPrice,
    currentPrice,
    marketValue,
    costBasis,
    pnl: Math.round((marketValue - costBasis) * 100) / 100,
    pnlPercent: costBasis > 0 ? Math.round(((marketValue - costBasis) / costBasis) * 10000) / 100 : 0,
  };
}

export async function getCandles(companyId: string): Promise<CandleData[]> {
  await initDb();
  const db = getDb();

  const res = await db.execute({
    sql: `SELECT * FROM (
            SELECT * FROM candles
            WHERE company_id = ?
            ORDER BY time_bucket DESC
            LIMIT 50
          ) ORDER BY time_bucket ASC`,
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

export async function getUserPortfolio(userId: string): Promise<{
  positions: PortfolioPosition[];
  tradingPositions: PortfolioPosition[];
  founderPositions: PortfolioPosition[];
  totalNetWorth: number;
  tradingNetWorth: number;
  totalStockValue: number;
  tradingStockValue: number;
  founderStockValue: number;
  cashBalance: number;
  lockedCash: number;
}> {
  await initDb();
  const db = getDb();

  const userRes = await db.execute({
    sql: "SELECT cash_balance, locked_cash FROM users WHERE id = ?",
    args: [userId],
  });
  const cashBalance = userRes.rows.length > 0 ? Number(userRes.rows[0].cash_balance) : 0;
  const lockedCash = userRes.rows.length > 0 ? Number(userRes.rows[0].locked_cash) : 0;

  const res = await db.execute({
    sql: `SELECT p.*, c.ticker, c.name, c.current_price, c.creator_id, c.total_shares, c.float_shares, c.ipo_fee_collected, c.treasury_balance 
          FROM portfolios p
          JOIN companies c ON p.company_id = c.id
          WHERE p.user_id = ? AND (p.shares > 0 OR p.locked_shares > 0)
          ORDER BY (p.shares * c.current_price) DESC`,
    args: [userId],
  });

  let totalStockValue = 0;
  let tradingStockValue = 0;
  let founderStockValue = 0;
  const tradingPositions: PortfolioPosition[] = [];
  const founderPositions: PortfolioPosition[] = [];

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
    const isCreator = String(r.creator_id) === String(userId);
    const totalCompanyShares = Number(r.total_shares || 0);
    const floatShares = Number(r.float_shares || 0);
    const ownershipPercent = totalCompanyShares > 0 ? Math.round((shares / totalCompanyShares) * 10000) / 100 : 0;
    const ipoFeeCollected = Number(r.ipo_fee_collected || 0);

    totalStockValue += marketValue;

    const pos: PortfolioPosition = {
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
      creatorId: String(r.creator_id),
      isCreator,
      totalCompanyShares,
      floatShares,
      ownershipPercent,
      ipoFeeCollected,
      treasuryBalance: isCreator ? Number(r.treasury_balance || 0) : undefined,
    };

    if (isCreator) {
      founderPositions.push(pos);
      founderStockValue += marketValue;
    } else {
      tradingPositions.push(pos);
      tradingStockValue += marketValue;
    }

    return pos;
  });

  const totalNetWorth = Math.round((cashBalance + lockedCash + totalStockValue) * 100) / 100;
  const tradingNetWorth = Math.round((cashBalance + lockedCash + tradingStockValue) * 100) / 100;

  return {
    positions,
    tradingPositions,
    founderPositions,
    totalNetWorth,
    tradingNetWorth,
    totalStockValue: Math.round(totalStockValue * 100) / 100,
    tradingStockValue: Math.round(tradingStockValue * 100) / 100,
    founderStockValue: Math.round(founderStockValue * 100) / 100,
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

  // Assign all company shares to creator (founder retained + float listed for sale)
  await db.execute({
    sql: `INSERT OR REPLACE INTO portfolios (id, user_id, company_id, shares, locked_shares, avg_buy_price)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [`port_${params.creatorId}_${ticker}`, params.creatorId, companyId, totalShares, floatShares, ipoPrice],
  });

  // Place Primary IPO Offering sell order under the creator's name
  // When citizens buy, the gold flows directly to the company founder!
  const orderId = `ord_ipo_${companyId}`;
  await db.execute({
    sql: `INSERT OR REPLACE INTO orders (id, user_id, company_id, type, order_type, price, initial_quantity, remaining_quantity, status, created_at)
          VALUES (?, ?, ?, 'SELL', 'LIMIT', ?, ?, ?, 'OPEN', ?)`,
    args: [orderId, params.creatorId, companyId, ipoPrice, floatShares, floatShares, now],
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
  discordId?: string;
  businessType?: "FACTORY" | "PRESS" | "SPECIAL";
  weeklyRevenue?: number;
  factoryLevel?: number;
  workersCount?: number;
  productionOutput?: string;
  pressViewers?: string;
  pressFrequency?: string;
  specialNotes?: string;
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
  discordId?: string;
  businessType?: "FACTORY" | "PRESS" | "SPECIAL";
  weeklyRevenue?: number;
  factoryLevel?: number;
  workersCount?: number;
  productionOutput?: string;
  pressViewers?: string;
  pressFrequency?: string;
  specialNotes?: string;
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
    sql: `INSERT INTO ipo_applications (
            id, user_id, parlamentum_name, ticker, name, description, sector,
            proposed_total_shares, proposed_ipo_price, proposed_founder_retain_percent,
            logo_url, status, created_at,
            discord_id, business_type, weekly_revenue, factory_level, workers_count,
            production_output, press_viewers, press_frequency, special_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      params.discordId ? params.discordId.trim() : null,
      params.businessType || "FACTORY",
      params.weeklyRevenue ? Number(params.weeklyRevenue) : 0,
      params.factoryLevel ? Number(params.factoryLevel) : null,
      params.workersCount ? Number(params.workersCount) : null,
      params.productionOutput ? params.productionOutput.trim() : null,
      params.pressViewers ? params.pressViewers.trim() : null,
      params.pressFrequency ? params.pressFrequency.trim() : null,
      params.specialNotes ? params.specialNotes.trim() : null,
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
    discordId: r.discord_id ? String(r.discord_id) : undefined,
    businessType: (r.business_type as any) || "FACTORY",
    weeklyRevenue: r.weekly_revenue != null ? Number(r.weekly_revenue) : 0,
    factoryLevel: r.factory_level != null ? Number(r.factory_level) : undefined,
    workersCount: r.workers_count != null ? Number(r.workers_count) : undefined,
    productionOutput: r.production_output ? String(r.production_output) : undefined,
    pressViewers: r.press_viewers ? String(r.press_viewers) : undefined,
    pressFrequency: r.press_frequency ? String(r.press_frequency) : undefined,
    specialNotes: r.special_notes ? String(r.special_notes) : undefined,
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
    discordId: r.discord_id ? String(r.discord_id) : undefined,
    businessType: (r.business_type as any) || "FACTORY",
    weeklyRevenue: r.weekly_revenue != null ? Number(r.weekly_revenue) : 0,
    factoryLevel: r.factory_level != null ? Number(r.factory_level) : undefined,
    workersCount: r.workers_count != null ? Number(r.workers_count) : undefined,
    productionOutput: r.production_output ? String(r.production_output) : undefined,
    pressViewers: r.press_viewers ? String(r.press_viewers) : undefined,
    pressFrequency: r.press_frequency ? String(r.press_frequency) : undefined,
    specialNotes: r.special_notes ? String(r.special_notes) : undefined,
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

  // Carry the application's revenue estimate and Discord contact over to the listed company
  if (listRes.company) {
    await db.execute({
      sql: "UPDATE companies SET weekly_revenue = ?, discord_handle = ? WHERE id = ?",
      args: [Math.max(0, Number(app.weekly_revenue || 0)), app.discord_id ? String(app.discord_id) : null, listRes.company.id],
    });
  }

  // Update application status
  await db.execute({
    sql: `UPDATE ipo_applications SET status = 'APPROVED', final_price = ?, operator_notes = ? WHERE id = ?`,
    args: [finalPrice, operatorNotes || "Charter approved and listed on exchange", appId],
  });

  scheduleBlobPersist();

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

  scheduleBlobPersist();

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

  // 3. Find open SELL orders on the book, lowest price first (not the buyer's own, e.g. the founder's unsold IPO float)
  const sellOrdersRes = await db.execute({
    sql: `SELECT * FROM orders
          WHERE company_id = ? AND type = 'SELL' AND status IN ('OPEN', 'PARTIAL') AND remaining_quantity > 0 AND user_id != ?
          ORDER BY price ASC, created_at ASC`,
    args: [companyId, params.founderId],
  });

  if (sellOrdersRes.rows.length === 0) {
    return { success: false, message: `No open sell orders available on the book for $${company.ticker} to buy back.` };
  }

  // Take the whole allocation from the founder's purse up front, only if it is still there
  // (parallel buybacks must not spend the same gold); the unspent rest is refunded below
  const escrow = await db.execute({
    sql: "UPDATE users SET cash_balance = cash_balance - ? WHERE id = ? AND cash_balance >= ?",
    args: [goldToSpend, params.founderId, goldToSpend],
  });
  if (escrow.rowsAffected === 0) {
    return { success: false, message: `Insufficient gold balance for a ${goldToSpend.toFixed(2)} gold buyback.` };
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

    // Claim those shares on the ask first; skip it if a parallel order already took them
    const claim = await db.execute({
      sql: `UPDATE orders SET remaining_quantity = remaining_quantity - ?,
              status = CASE WHEN remaining_quantity - ? = 0 THEN 'FILLED' ELSE 'PARTIAL' END
            WHERE id = ? AND status IN ('OPEN', 'PARTIAL') AND remaining_quantity >= ?`,
      args: [fillQty, fillQty, orderId, fillQty],
    });
    if (claim.rowsAffected === 0) continue;

    remainingGold -= cost;
    totalGoldSpent += cost;
    totalSharesAcquired += fillQty;
    lastFillPrice = askPrice;

    const feePercentStr = await getSetting("trade_fee_percent", "1.0");
    const feeRate = (parseFloat(feePercentStr) || 1.0) / 100;
    const fee = Math.round(cost * feeRate * 100) / 100;
    const netSellerProceeds = cost - fee;

    await db.execute({
      sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
      args: [netSellerProceeds, sellerId],
    });

    // The sold shares leave the seller's portfolio (they were escrowed by the sell order)
    await db.execute({
      sql: "UPDATE portfolios SET shares = shares - ?, locked_shares = locked_shares - ? WHERE user_id = ? AND company_id = ?",
      args: [fillQty, fillQty, sellerId, companyId],
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

  // Return the unspent part of the allocation to the founder's purse
  const unspentGold = Math.round((goldToSpend - totalGoldSpent) * 100) / 100;
  if (unspentGold > 0) {
    await db.execute({
      sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
      args: [unspentGold, params.founderId],
    });
  }

  if (totalSharesAcquired === 0) {
    return {
      success: false,
      message: `Could not buy any shares. Lowest ask price is higher than allocated gold (${goldToSpend}g).`
    };
  }

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

