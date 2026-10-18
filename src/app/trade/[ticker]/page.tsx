"use client";

import { useEffect, useState, use, Suspense } from "react";
import Navbar from "@/components/Navbar";
import CandleChart from "@/components/CandleChart";
import OrderBook from "@/components/OrderBook";
import TradeForm from "@/components/TradeForm";
import RecentTrades from "@/components/RecentTrades";
import OpenOrdersTable from "@/components/OpenOrdersTable";
import { Company, OrderBookData, TradeItem, CandleData, PortfolioPosition } from "@/lib/market";
import { TrendingUp, TrendingDown, PieChart, ShieldAlert, FileText, ArrowLeft, AlertTriangle, Flame, X, Coins, Shield } from "lucide-react";
import Link from "next/link";

function TradeContent({ params }: { params: Promise<{ ticker: string }> }) {
  const resolvedParams = use(params);
  const ticker = resolvedParams.ticker.toUpperCase();

  const [company, setCompany] = useState<Company | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [recentTrades, setRecentTrades] = useState<TradeItem[]>([]);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [userHolding, setUserHolding] = useState<PortfolioPosition | null>(null);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [userCash, setUserCash] = useState<number>(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [marketSchedule, setMarketSchedule] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Buyback state
  const [isBuybackOpen, setIsBuybackOpen] = useState<boolean>(false);
  const [buybackGold, setBuybackGold] = useState<string>("500");
  const [buybackLoading, setBuybackLoading] = useState<boolean>(false);
  const [buybackFeedback, setBuybackFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchTerminalData = async () => {
    try {
      const res = await fetch(`/api/market/${ticker}`);
      const data = await res.json();
      if (data.success) {
        setCompany(data.company);
        setOrderBook(data.orderBook);
        setRecentTrades(data.recentTrades);
        setCandles(data.candles);
        setUserHolding(data.userHolding);
        setUserOrders(data.userOrders);
        if (data.user) {
          setCurrentUser(data.user);
          setUserCash(data.user.cashBalance);
        }
        if (data.marketSchedule) {
          setMarketSchedule(data.marketSchedule);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteBuyback = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuybackFeedback(null);
    const gold = parseFloat(buybackGold);
    if (isNaN(gold) || gold < 10) {
      setBuybackFeedback({ type: "error", message: "Minimum buyback allocation is 10 gold." });
      return;
    }
    setBuybackLoading(true);
    try {
      const res = await fetch("/api/buyback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, goldToSpend: gold }),
      });
      const data = await res.json();
      if (data.success) {
        setBuybackFeedback({ type: "success", message: data.message });
        fetchTerminalData();
      } else {
        setBuybackFeedback({ type: "error", message: data.message || "Buyback failed." });
      }
    } catch (err: any) {
      setBuybackFeedback({ type: "error", message: err.message || "Network error" });
    } finally {
      setBuybackLoading(false);
    }
  };

  useEffect(() => {
    fetchTerminalData();
    const interval = setInterval(fetchTerminalData, 4000);
    return () => clearInterval(interval);
  }, [ticker]);

  if (loading && !company) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-amber-400 font-mono text-sm">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          Loading exchange order books for ${ticker}...
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-[60vh]">
        <ShieldAlert className="w-12 h-12 text-rose-500" />
        <h2 className="text-xl font-bold">Company ${ticker} Not Found</h2>
        <p className="text-zinc-400 text-sm">This ticker symbol is not currently listed on the exchange.</p>
        <Link href="/" className="px-4 py-2 bg-amber-500 text-black font-semibold rounded-lg text-sm">
          Back to Markets
        </Link>
      </div>
    );
  }

  const isUp = company.change24h >= 0;

  return (
    <main className="max-w-[1600px] w-full mx-auto p-3 sm:p-4 md:p-6 flex flex-col gap-4">
      {/* Ticker Header Banner */}
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition"
            title="All Markets"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="text-3xl bg-zinc-950 border border-zinc-800 w-12 h-12 rounded-xl flex items-center justify-center">
            {company.logoUrl || "🏛️"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {company.name}
              </h1>
              <span className="font-mono text-sm font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded">
                ${company.ticker}
              </span>
              <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                {company.sector}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 max-w-xl line-clamp-1">
              {company.description}
            </p>
          </div>
        </div>

        {/* Key Financial Metrics */}
        <div className="flex flex-wrap items-center gap-6 font-mono text-xs">
          <div>
            <div className="text-[10px] text-zinc-400 uppercase font-sans">Last Traded Price</div>
            <div className="text-xl sm:text-2xl font-bold text-white flex items-center gap-1.5">
              <span>{company.currentPrice.toFixed(2)} gold</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 ${
                  isUp ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                }`}
              >
                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isUp ? "+" : ""}
                {company.change24h.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="hidden sm:block border-l border-zinc-800 pl-4">
            <div className="text-[10px] text-zinc-400 uppercase font-sans">24h High / Low</div>
            <div className="text-zinc-200 font-semibold mt-0.5">
              {company.high24h.toFixed(2)} / {company.low24h.toFixed(2)} gold
            </div>
          </div>

          <div className="hidden sm:block border-l border-zinc-800 pl-4">
            <div className="text-[10px] text-zinc-400 uppercase font-sans">24h Volume</div>
            <div className="text-zinc-200 font-semibold mt-0.5">
              {company.volume24h.toLocaleString("en-US", { maximumFractionDigits: 0 })} gold
            </div>
          </div>

          <div className="border-l border-zinc-800 pl-4">
            <div className="text-[10px] text-zinc-400 uppercase font-sans">Market Cap</div>
            <div className="text-amber-400 font-bold mt-0.5">
              {company.marketCap.toLocaleString("en-US", { maximumFractionDigits: 0 })} gold
            </div>
          </div>
        </div>
      </div>

      {/* Company Status Alerts */}
      {company.status === "HALTED" && (
        <div className="bg-amber-950/70 border border-amber-500/60 text-amber-200 px-4 py-3 rounded-xl flex items-center gap-3 text-xs shadow-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <span className="font-bold uppercase tracking-wider block">⏸️ Trading Halted by Exchange Operator</span>
            <span>Trading for ${company.ticker} is temporarily paused for price stabilization.</span>
          </div>
        </div>
      )}

      {company.status === "DEFAULTED" && (
        <div className="bg-rose-950/80 border border-rose-600/80 text-rose-200 px-4 py-3 rounded-xl flex items-center gap-3 text-xs shadow-lg">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <span className="font-bold uppercase tracking-wider block">🚨 Flagged as Defaulted / Suspected Scam</span>
            <span>The Exchange Operator has flagged this enterprise for default or breach of terms. Order matching is permanently locked.</span>
          </div>
        </div>
      )}

      {/* Founder Control & Share Buyback Banner (Method 3) */}
      {currentUser && (company.creatorId === currentUser.id || currentUser.isAdmin) && (
        <div className="bg-gradient-to-r from-amber-950/30 via-zinc-900/80 to-zinc-950 border border-amber-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 text-xl">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Founder Control · Method 3
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono">
                  Corporate Buyback
                </span>
              </div>
              <h3 className="text-white font-bold text-sm mt-0.5">
                Redeem & Buy Back Public Shares
              </h3>
              <p className="text-zinc-400 text-xs mt-0.5 max-w-xl">
                Deploy your in-game profits to sweep open sell orders from the book. Bought shares are retired from circulation, shrinking the float and pumping the stock price!
              </p>
              {company.sharesBoughtBack > 0 && (
                <div className="text-[11px] text-emerald-400 font-mono mt-1 font-semibold flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Total Bought Back: {company.sharesBoughtBack.toLocaleString()} shares ({company.buybackGoldSpent.toLocaleString()} gold deployed)
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              setIsBuybackOpen(true);
              setBuybackFeedback(null);
            }}
            className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shrink-0 cursor-pointer shadow-lg shadow-amber-500/20 flex items-center gap-2"
          >
            <Coins className="w-3.5 h-3.5" />
            Initiate Share Buyback
          </button>
        </div>
      )}

      {/* Buyback Modal */}
      {isBuybackOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsBuybackOpen(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xl">
                🔥
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  Corporate Share Buyback (${company.ticker})
                </h3>
                <p className="text-zinc-400 text-xs">
                  Reclaim equity & reward your shareholders
                </p>
              </div>
            </div>

            <form onSubmit={handleExecuteBuyback} className="space-y-4 text-xs font-sans">
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 leading-relaxed text-[11px]">
                Enter how much gold from your purse to allocate. The matching engine will execute market buys starting from the lowest sell ask, sweeping orders and permanently retiring the shares.
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-zinc-300">
                    Gold To Deploy (Purse: {userCash.toFixed(0)}g)
                  </label>
                  <button
                    type="button"
                    onClick={() => setBuybackGold(Math.floor(userCash).toString())}
                    className="text-amber-400 hover:underline text-[10px]"
                  >
                    Max ({Math.floor(userCash)}g)
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="10"
                    max={userCash}
                    value={buybackGold}
                    onChange={(e) => setBuybackGold(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                    placeholder="e.g. 500"
                  />
                  <span className="absolute right-3 top-2.5 text-zinc-500 text-xs font-mono">gold</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[100, 500, 1000, 2500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setBuybackGold(amt.toString())}
                    className="py-1 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-[11px] transition cursor-pointer"
                  >
                    +{amt}g
                  </button>
                ))}
              </div>

              {buybackFeedback && (
                <div
                  className={`p-3 rounded-lg text-[11px] border leading-relaxed ${
                    buybackFeedback.type === "success"
                      ? "bg-emerald-950/60 border-emerald-600/40 text-emerald-300"
                      : "bg-rose-950/60 border-rose-600/40 text-rose-300"
                  }`}
                >
                  {buybackFeedback.message}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsBuybackOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={buybackLoading || userCash < 10}
                  className={`px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer ${
                    buybackLoading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {buybackLoading ? "Sweeping Order Book..." : "Execute Buyback"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Grid: Left Chart & Panels, Right Trading & Order Books */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (8 cols): Chart, Holdings, Open Orders */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Candlestick Chart */}
          <CandleChart
            candles={candles}
            ticker={company.ticker}
            currentPrice={company.currentPrice}
          />

          {/* User Holdings Card for this stock */}
          {userHolding && userHolding.shares > 0 && (
            <div className="bg-zinc-900/60 border border-emerald-500/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                  <PieChart className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-zinc-400 uppercase font-bold tracking-wider">
                    Your Position in ${company.ticker}
                  </div>
                  <div className="text-base font-bold text-white font-mono">
                    {userHolding.shares.toLocaleString()} shares{" "}
                    <span className="text-xs text-zinc-400 font-normal">
                      ({userHolding.lockedShares} locked in sell orders)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 font-mono text-xs">
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-sans">Avg Entry Price</div>
                  <div className="font-semibold text-zinc-200">{userHolding.avgBuyPrice.toFixed(2)} gold</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-sans">Market Value</div>
                  <div className="font-semibold text-zinc-200">{userHolding.marketValue.toFixed(2)} gold</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-sans">Unrealized P&L</div>
                  <div
                    className={`font-bold ${
                      userHolding.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {userHolding.pnl >= 0 ? "+" : ""}{userHolding.pnl.toFixed(2)} gold ({userHolding.pnlPercent}%)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Open Orders Table */}
          <OpenOrdersTable
            orders={userOrders}
            onOrderCancelled={fetchTerminalData}
          />

          {/* Company Lore & Financial Details */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 text-xs">
            <h4 className="font-bold text-white text-sm flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-amber-400" />
              Parliamentary Charter & Shareholder Lore
            </h4>
            <p className="text-zinc-400 leading-relaxed mb-3">
              {company.description}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[11px] pt-3 border-t border-zinc-800/60">
              <div>
                <span className="text-zinc-400 block font-sans text-[10px]">Total Shares</span>
                <span className="text-zinc-200">{company.totalShares.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-zinc-400 block font-sans text-[10px]">Public Float</span>
                <span className="text-zinc-200">{company.floatShares.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-zinc-400 block font-sans text-[10px]">Charter Founder</span>
                <span className="text-zinc-200">{company.creatorName}</span>
              </div>
              <div>
                <span className="text-zinc-400 block font-sans text-[10px]">Initial IPO Price</span>
                <span className="text-amber-400">{company.ipoPrice.toFixed(2)} gold</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Order Book, Trade Form, Recent Fills */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Trade Placement Form */}
          <TradeForm
            company={company}
            userHolding={userHolding}
            userCash={userCash}
            selectedPrice={selectedPrice}
            marketSchedule={marketSchedule}
            onTradeSuccess={fetchTerminalData}
          />

          {/* Live Order Book */}
          {orderBook && (
            <OrderBook
              orderBook={orderBook}
              ticker={company.ticker}
              onSelectPrice={(p) => setSelectedPrice(p)}
            />
          )}

          {/* Recent Executed Trades */}
          <RecentTrades trades={recentTrades} />
        </div>
      </div>
    </main>
  );
}

export default function TradePage(props: { params: Promise<{ ticker: string }> }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <Navbar />
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-3 text-amber-400 font-mono text-sm">
            <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            Loading terminal...
          </div>
        </div>
      }>
        <TradeContent params={props.params} />
      </Suspense>
    </div>
  );
}
