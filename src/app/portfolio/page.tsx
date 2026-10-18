"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import WalletModal from "@/components/WalletModal";
import Link from "next/link";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Coins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Lock, 
  XCircle, 
  PieChart,
  PlusCircle 
} from "lucide-react";
import { PortfolioPosition } from "@/lib/market";

interface PortfolioResponse {
  positions: PortfolioPosition[];
  totalNetWorth: number;
  totalStockValue: number;
  cashBalance: number;
  lockedCash: number;
}

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [walletTab, setWalletTab] = useState<"deposit" | "withdraw" | "history">("deposit");

  const fetchPortfolio = async () => {
    try {
      const res = await fetch("/api/portfolio", { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setData(json.portfolio);
        setOpenOrders(json.openOrders || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();

    const handleSync = () => {
      fetchPortfolio();
    };

    window.addEventListener("wallet_updated", handleSync);
    window.addEventListener("focus", handleSync);

    const interval = setInterval(fetchPortfolio, 2500);

    return () => {
      clearInterval(interval);
      window.removeEventListener("wallet_updated", handleSync);
      window.removeEventListener("focus", handleSync);
    };
  }, []);

  const handleCancelOrder = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const resJson = await res.json();
      if (resJson.success) {
        fetchPortfolio();
      } else {
        alert(resJson.message || "Failed to cancel order");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCancellingId(null);
    }
  };

  const totalCostBasis = (data?.positions || []).reduce((sum, p) => sum + p.costBasis, 0);
  const totalPnl = (data?.totalStockValue || 0) - totalCostBasis;
  const totalPnlPercent = totalCostBasis > 0 ? Math.round((totalPnl / totalCostBasis) * 10000) / 100 : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <Navbar onUserRefresh={fetchPortfolio} />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6 flex-1">
        {/* Title & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
              <Wallet className="w-7 h-7 text-amber-400" />
              Citizen Investment Portfolio
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Track your asset holdings, net worth valuation, and manage your gold purse.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setWalletTab("deposit");
                setIsWalletOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              Put Gold In
            </button>
            <button
              onClick={() => {
                setWalletTab("withdraw");
                setIsWalletOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-amber-300 font-bold text-xs transition cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              Take Gold Out
            </button>
          </div>
        </div>

        {/* Financial Net Worth Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Net Worth */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Total Net Worth</span>
              <PieChart className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {loading && !data ? (
                <span className="text-zinc-500 animate-pulse">-- gold</span>
              ) : (
                <>
                  {(data?.totalNetWorth || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-xs font-sans text-zinc-400">gold</span>
                </>
              )}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">Cash + Stock Holdings</div>
          </div>

          {/* Liquid Cash */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Purse Gold</span>
              <Coins className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {loading && !data ? (
                <span className="text-zinc-500 animate-pulse">-- gold</span>
              ) : (
                <>
                  {(data?.cashBalance || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-xs font-sans text-zinc-400">gold</span>
                </>
              )}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1">
              <Lock className="w-3 h-3 text-zinc-500" />
              {(data?.lockedCash || 0).toFixed(0)} gold locked in bids
            </div>
          </div>

          {/* Stock Holdings Value */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Equities Valuation</span>
              <DollarSign className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-blue-400">
              {(data?.totalStockValue || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-xs font-sans text-zinc-400">gold</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              {(data?.positions || []).length} chartered companies held
            </div>
          </div>

          {/* Total Unrealized P&L */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Unrealized Return</span>
              {totalPnl >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div
              className={`text-2xl font-bold font-mono ${
                totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(0)} gold
            </div>
            <div className="text-[11px] font-mono text-zinc-400 mt-1">
              {totalPnl >= 0 ? "+" : ""}{totalPnlPercent}% overall return
            </div>
          </div>
        </div>

        {/* Owned Positions Table */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">Your Stock Holdings</h3>
            <span className="text-zinc-400 text-xs font-mono">
              {(data?.positions || []).length} assets held
            </span>
          </div>

          {(data?.positions || []).length === 0 ? (
            <div className="p-12 text-center text-zinc-400 text-xs flex flex-col items-center gap-3">
              <p>You do not hold any company shares yet.</p>
              <div className="flex gap-2">
                <Link
                  href="/ipo"
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5 inline mr-1" />
                  Launch an IPO
                </Link>
                <Link
                  href="/"
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs"
                >
                  View Markets Floor
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs">
                <thead>
                  <tr className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                    <th className="py-3 px-4">Ticker / Company</th>
                    <th className="py-3 px-4 text-right">Shares (Avail / Locked)</th>
                    <th className="py-3 px-4 text-right">Avg Entry Price</th>
                    <th className="py-3 px-4 text-right">Current Price</th>
                    <th className="py-3 px-4 text-right">Market Value</th>
                    <th className="py-3 px-4 text-right">Unrealized P&L</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {(data?.positions || []).map((pos) => {
                    const isProfit = pos.pnl >= 0;
                    return (
                      <tr key={pos.companyId} className="hover:bg-zinc-800/30">
                        <td className="py-3.5 px-4 font-sans">
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>${pos.ticker}</span>
                            <span className="text-zinc-400 text-xs font-normal font-sans">
                              {pos.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right text-zinc-200">
                          <span className="font-bold">{pos.availableShares}</span>{" "}
                          <span className="text-zinc-400 text-[11px]">/ {pos.shares}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-zinc-300">
                          {pos.avgBuyPrice.toFixed(2)} gold
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-white">
                          {pos.currentPrice.toFixed(2)} gold
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-zinc-100">
                          {pos.marketValue.toLocaleString("en-US", { minimumFractionDigits: 0 })} gold
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`font-bold ${
                              isProfit ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isProfit ? "+" : ""}{pos.pnl.toFixed(0)} gold ({isProfit ? "+" : ""}
                            {pos.pnlPercent}%)
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-sans">
                          <Link
                            href={`/trade/${pos.ticker}`}
                            className="inline-block px-3 py-1 rounded bg-zinc-800 hover:bg-amber-500 hover:text-black text-zinc-200 font-semibold text-xs transition"
                          >
                            Trade
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Open Orders Section */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">Active Orders on the Exchange</h3>
            <span className="text-zinc-400 text-xs font-mono">{openOrders.length} orders</span>
          </div>

          {openOrders.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 text-xs">
              No active open orders in the book.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800 font-sans">
                    <th className="py-3 px-4">Side</th>
                    <th className="py-3 px-4">Ticker</th>
                    <th className="py-3 px-4 text-right">Price</th>
                    <th className="py-3 px-4 text-right">Filled / Total</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Cancel Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-[11px]">
                  {openOrders.map((ord) => {
                    const isBuy = ord.type === "BUY";
                    return (
                      <tr key={ord.id} className="hover:bg-zinc-800/30">
                        <td className="py-3 px-4">
                          <span
                            className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                              isBuy
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                            }`}
                          >
                            {ord.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-white">${ord.ticker}</td>
                        <td className="py-3 px-4 text-right text-zinc-200">{ord.price.toFixed(2)} gold</td>
                        <td className="py-3 px-4 text-right text-zinc-300">
                          {ord.filledQuantity} / {ord.initialQuantity}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-[10px] bg-zinc-800 text-amber-300 px-2 py-0.5 rounded">
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleCancelOrder(ord.id)}
                            disabled={cancellingId === ord.id}
                            className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded transition cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            {cancellingId === ord.id ? "Cancelling..." : "Cancel"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Wallet Modal */}
      <WalletModal
        isOpen={isWalletOpen}
        initialTab={walletTab}
        onClose={() => setIsWalletOpen(false)}
        onBalanceUpdated={fetchPortfolio}
      />
    </div>
  );
}
