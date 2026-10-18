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
  const [userCash, setUserCash] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const val = localStorage.getItem("gug_cached_cash");
        if (val) return parseFloat(val) || 0;
      } catch {}
    }
    return 0;
  });
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [marketSchedule, setMarketSchedule] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Buyback state
  const [isBuybackOpen, setIsBuybackOpen] = useState<boolean>(false);
  const [buybackGold, setBuybackGold] = useState<string>("500");
  const [buybackLoading, setBuybackLoading] = useState<boolean>(false);
  const [buybackFeedback, setBuybackFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // 50% Profit Dividend & Earnings state
  const [isDividendModalOpen, setIsDividendModalOpen] = useState<boolean>(false);
  const [dividendProfit, setDividendProfit] = useState<string>("1000");
  const [dividendRevenue, setDividendRevenue] = useState<string>("2000");
  const [dividendExpenses, setDividendExpenses] = useState<string>("1000");
  const [dividendNotes, setDividendNotes] = useState<string>("Weekly 50% profit allocation from in-game operations.");
  const [distributeImmediately, setDistributeImmediately] = useState<boolean>(false);
  const [dividendLoading, setDividendLoading] = useState<boolean>(false);
  const [dividendFeedback, setDividendFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [earningsReports, setEarningsReports] = useState<any[]>([]);
  const [shareholders, setShareholders] = useState<any[]>([]);
  const [nextFriday, setNextFriday] = useState<string>("");

  const fetchTerminalData = async () => {
    try {
      const res = await fetch(`/api/market/${ticker}`, { cache: "no-store" });
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
          try { localStorage.setItem("gug_cached_cash", data.user.cashBalance.toString()); } catch {}
        }
        if (data.marketSchedule) {
          setMarketSchedule(data.marketSchedule);
        }
        if (data.earningsReports) setEarningsReports(data.earningsReports);
        if (data.shareholders) setShareholders(data.shareholders);
        if (data.nextFriday) setNextFriday(data.nextFriday);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReportDividend = async (e: React.FormEvent) => {
    e.preventDefault();
    setDividendFeedback(null);
    const profit = parseFloat(dividendProfit);
    if (isNaN(profit) || profit <= 0) {
      setDividendFeedback({ type: "error", message: "Net profit must be greater than 0 gold." });
      return;
    }
    setDividendLoading(true);
    try {
      const res = await fetch("/api/dividends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report_earnings",
          companyId: company?.id,
          grossRevenue: dividendRevenue ? parseFloat(dividendRevenue) : profit,
          operatingExpenses: dividendExpenses ? parseFloat(dividendExpenses) : 0,
          netProfit: profit,
          notes: dividendNotes,
          distributeImmediately,
          scheduledFor: nextFriday,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDividendFeedback({ type: "success", message: data.message });
        fetchTerminalData();
      } else {
        setDividendFeedback({ type: "error", message: data.message || "Failed to submit earnings report." });
      }
    } catch (err: any) {
      setDividendFeedback({ type: "error", message: err.message || "Network error" });
    } finally {
      setDividendLoading(false);
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

    const handleSync = () => {
      fetchTerminalData();
    };

    window.addEventListener("wallet_updated", handleSync);
    window.addEventListener("focus", handleSync);

    const interval = setInterval(fetchTerminalData, 2000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("wallet_updated", handleSync);
      window.removeEventListener("focus", handleSync);
    };
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

      {/* 50% Net Profit Weekly Dividend Desk (Friday 00:00 UTC) */}
      <div className="bg-gradient-to-r from-purple-950/40 via-zinc-900/90 to-zinc-950 border border-purple-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 text-xl font-bold">
            🪙
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                Dividend Policy
              </span>
              <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded font-mono font-bold">
                50% Net Profits Weekly
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                Friday 00:00 UTC
              </span>
            </div>
            <h3 className="text-white font-bold text-sm mt-0.5">
              Weekly Profit Dividend Distribution
            </h3>
            <p className="text-zinc-400 text-xs mt-0.5 max-w-xl leading-relaxed">
              50% of audited weekly in-game enterprise profits are automatically allocated and credited to all citizen and sovereign state shareholders every Friday at 00:00 UTC.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono mt-1.5">
              <span className="text-zinc-400">
                Next Payout: <strong className="text-amber-400">{nextFriday ? new Date(nextFriday).toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' }) : "Every Friday"} at 00:00 UTC</strong>
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-400">
                Total Distributed to Date: <strong className="text-emerald-400 font-bold">{((company as any).totalDividendsPaid || 0).toLocaleString()} gold</strong>
              </span>
            </div>
          </div>
        </div>

        {currentUser && (company.creatorId === currentUser.id || currentUser.isAdmin) && (
          <button
            onClick={() => {
              setIsDividendModalOpen(true);
              setDividendFeedback(null);
            }}
            className="px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shrink-0 cursor-pointer shadow-lg shadow-purple-600/20 flex items-center gap-2"
          >
            <Coins className="w-3.5 h-3.5" />
            Report Friday Earnings & Declare 50% Dividend
          </button>
        )}
      </div>

      {/* Friday Earnings & 50% Profit Dividend Modal */}
      {isDividendModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsDividendModalOpen(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xl font-bold">
                🪙
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  File Weekly Earnings & 50% Dividend (${company.ticker})
                </h3>
                <p className="text-zinc-400 text-xs">
                  Allocate in-game enterprise profits to your investors
                </p>
              </div>
            </div>

            <form onSubmit={handleReportDividend} className="space-y-4 text-xs font-sans">
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1.5 text-zinc-300 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Authorized Shares:</span>
                  <strong className="text-white font-mono">{company.totalShares.toLocaleString()} shares</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Charter Dividend Rate:</span>
                  <strong className="text-purple-400 font-mono">50.00% of Net Profits</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Scheduled Payout Date:</span>
                  <strong className="text-amber-400 font-mono">{nextFriday ? new Date(nextFriday).toLocaleDateString("en-US", { weekday: 'long', month: 'short', day: 'numeric' }) : "Friday"} 00:00 UTC</strong>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-300 block mb-1">
                  Net Profit to Distribute (Gold)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={dividendProfit}
                    onChange={(e) => setDividendProfit(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 font-mono text-emerald-400 font-bold text-sm focus:outline-none focus:border-purple-400"
                  />
                  <span className="absolute right-3 top-2.5 text-zinc-500 text-xs font-mono">gold</span>
                </div>
              </div>

              {/* Dynamic Live Calculation Card */}
              {(() => {
                const profitNum = parseFloat(dividendProfit) || 0;
                const poolNum = Math.round(profitNum * 0.5 * 100) / 100;
                const perShareNum = company.totalShares > 0 ? (poolNum / company.totalShares) : 0;
                return (
                  <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl grid grid-cols-2 gap-2 font-mono text-[11px]">
                    <div>
                      <span className="text-zinc-400 block font-sans text-[10px]">50% Dividend Pool:</span>
                      <strong className="text-amber-400 text-sm">{poolNum.toLocaleString()} gold</strong>
                    </div>
                    <div>
                      <span className="text-zinc-400 block font-sans text-[10px]">Per-Share Payout:</span>
                      <strong className="text-emerald-400 text-sm">{perShareNum.toFixed(4)} gold</strong>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-300 block mb-1">
                  Note to Shareholders / Earnings Lore
                </label>
                <input
                  type="text"
                  value={dividendNotes}
                  onChange={(e) => setDividendNotes(e.target.value)}
                  placeholder="e.g. Iron smelting expansion profits distributed"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="distributeImmediately"
                  checked={distributeImmediately}
                  onChange={(e) => setDistributeImmediately(e.target.checked)}
                  className="accent-purple-500 rounded cursor-pointer"
                />
                <label htmlFor="distributeImmediately" className="text-[11px] text-zinc-300 cursor-pointer select-none">
                  Distribute immediately now (override Friday 00:00 UTC schedule)
                </label>
              </div>

              {dividendFeedback && (
                <div
                  className={`p-3 rounded-lg text-[11px] border leading-relaxed ${
                    dividendFeedback.type === "success"
                      ? "bg-emerald-950/60 border-emerald-600/40 text-emerald-300"
                      : "bg-rose-950/60 border-rose-600/40 text-rose-300"
                  }`}
                >
                  {dividendFeedback.message}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsDividendModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={dividendLoading}
                  className={`px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-lg shadow-purple-600/20 cursor-pointer ${
                    dividendLoading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {dividendLoading ? "Allocating..." : distributeImmediately ? "Authorize & Distribute Now" : "Schedule Friday Payout"}
                </button>
              </div>
            </form>
          </div>
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

          {/* Major & Sovereign State Shareholders Registry */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 text-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  Major & Sovereign State Shareholders
                </h4>
                <p className="text-zinc-400 text-[11px]">
                  Institutional sovereign vaults, republics, and premier citizens backing ${company.ticker}
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                Top {shareholders.length} Holders
              </span>
            </div>

            {shareholders.length === 0 ? (
              <div className="py-6 text-center text-zinc-400 font-mono text-xs border border-dashed border-zinc-800 rounded-lg">
                No recorded shareholdings registered yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-400 font-sans">
                      <th className="pb-2">Shareholder / Sovereign Realm</th>
                      <th className="pb-2 text-right">Shares Held</th>
                      <th className="pb-2 text-right">Equity Share</th>
                      <th className="pb-2 text-right">Est. Weekly 50% Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {shareholders.map((sh, idx) => {
                      const isState = sh.accountType === "STATE";
                      return (
                        <tr key={sh.userId || idx} className="hover:bg-zinc-800/30 transition">
                          <td className="py-2.5 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">
                                {isState ? (sh.stateCrest || "🏛️") : "👤"}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5 font-sans font-bold text-zinc-200">
                                  <span>{isState ? (sh.stateRealmName || sh.displayName) : (sh.displayName || sh.username)}</span>
                                  {isState && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                      👑 STATE RESERVE
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-400 font-sans">
                                  {isState ? `Delegate: ${sh.username}` : `@${sh.username}`}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 text-right font-bold text-white">
                            {sh.shares.toLocaleString()}
                          </td>
                          <td className="py-2.5 text-right text-amber-400 font-bold">
                            {sh.equityPercent}%
                          </td>
                          <td className="py-2.5 text-right text-emerald-400">
                            {company.totalShares > 0 && earningsReports.length > 0 && earningsReports[0].dividendPerShare
                              ? `${(sh.shares * earningsReports[0].dividendPerShare).toFixed(1)}g`
                              : `${((sh.shares / (company.totalShares || 1)) * 500).toFixed(1)}g est.`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Friday Profit Dividend Payout History & Earnings Reports */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 text-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  Friday 50% Profit Dividend Distributions
                </h4>
                <p className="text-zinc-400 text-[11px]">
                  Audited net profits & weekly automatic UTC 00:00 payouts directly credited to shareholder wallets
                </p>
              </div>
              <button
                onClick={() => setIsDividendModalOpen(true)}
                className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
              >
                + Report Earnings
              </button>
            </div>

            {earningsReports.length === 0 ? (
              <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-lg text-center text-zinc-400">
                <p className="font-mono text-xs mb-1">No earnings distributions posted yet for ${company.ticker}.</p>
                <p className="text-[11px] text-zinc-400">
                  Every Friday at 00:00 UTC, 50% of declared corporate net profit is partitioned and distributed to all current shareholders.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {earningsReports.map((report) => (
                  <div
                    key={report.id}
                    className="p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-sans">{report.periodName || "Weekly Earnings Cycle"}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-sans ${
                            report.status === "DISTRIBUTED"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                          }`}
                        >
                          {report.status === "DISTRIBUTED" ? "PAID OUT" : "SCHEDULED FRIDAY 00:00 UTC"}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1 font-sans">
                        Target Date: {new Date(report.scheduledFor || report.createdAt).toUTCString().slice(0, 22)}
                        {report.notes && <span className="text-zinc-400"> — {report.notes}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="text-[10px] text-zinc-400 uppercase font-sans">Audited Profit</div>
                        <div className="font-bold text-zinc-200">{Number(report.netProfit).toFixed(0)}g</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-400 uppercase font-sans">50% Dividend Pool</div>
                        <div className="font-bold text-amber-400">{Number(report.dividendPool).toFixed(1)}g</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-400 uppercase font-sans">Payout / Share</div>
                        <div className="font-bold text-emerald-400">{Number(report.dividendPerShare).toFixed(4)}g</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            onTradeSuccess={() => {
              fetchTerminalData();
              window.dispatchEvent(new Event("wallet_updated"));
            }}
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
