"use client";

import { useEffect, useState, use, Suspense } from "react";
import Navbar from "@/components/Navbar";
import CandleChart from "@/components/CandleChart";
import OrderBook from "@/components/OrderBook";
import TradeForm from "@/components/TradeForm";
import RecentTrades from "@/components/RecentTrades";
import OpenOrdersTable from "@/components/OpenOrdersTable";
import { Company, OrderBookData, TradeItem, CandleData, PortfolioPosition } from "@/lib/market";
import { TrendingUp, TrendingDown, PieChart, ShieldAlert, FileText, ArrowLeft } from "lucide-react";
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
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [marketSchedule, setMarketSchedule] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
