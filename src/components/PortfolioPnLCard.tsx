"use client";

import { useState } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  Share2, 
  Check, 
  Copy, 
  Sparkles, 
  Award, 
  Percent, 
  ArrowUpRight, 
  ArrowDownRight,
  Wallet,
  ShieldCheck
} from "lucide-react";
import { fmtGold, fmtPrice, fmtQty, fmtPct, fmtSigned, moveColor } from "@/lib/format";
import type { PortfolioPosition } from "@/lib/market";
import type { FeedUser } from "@/hooks/useMarketFeed";

interface PortfolioPnLCardProps {
  user?: FeedUser;
  positions: PortfolioPosition[];
  cashBalance: number;
  lockedCash: number;
  totalStockValue: number;
  totalNetWorth: number;
  totalDividendsEarned: number;
}

export default function PortfolioPnLCard({
  user,
  positions,
  cashBalance,
  lockedCash,
  totalStockValue,
  totalNetWorth,
  totalDividendsEarned,
}: PortfolioPnLCardProps) {
  const [copied, setCopied] = useState(false);

  const totalCostBasis = positions.reduce((sum, p) => sum + p.costBasis, 0);
  const totalUnrealizedPnl = Math.round((totalStockValue - totalCostBasis) * 100) / 100;
  const totalRoiPercent = totalCostBasis > 0 ? Math.round(((totalStockValue - totalCostBasis) / totalCostBasis) * 10000) / 100 : 0;

  // Identify best and worst performing assets
  const sortedByRoi = [...positions].sort((a, b) => b.pnlPercent - a.pnlPercent);
  const bestPerformer = sortedByRoi.length > 0 && sortedByRoi[0].pnlPercent > 0 ? sortedByRoi[0] : null;
  const worstPerformer = sortedByRoi.length > 1 && sortedByRoi[sortedByRoi.length - 1].pnlPercent < 0 ? sortedByRoi[sortedByRoi.length - 1] : null;

  const handleCopyFlexBag = () => {
    const username = user?.displayName || user?.username || "Citizen";
    const parlamentumName = user?.parlamentumName ? ` (@${user.parlamentumName})` : "";
    
    let holdingsText = "";
    if (positions.length === 0) {
      holdingsText = "• 100% Cash Reserve\n";
    } else {
      positions.forEach((p) => {
        const sign = p.pnl >= 0 ? "+" : "";
        holdingsText += `• $${p.ticker}: ${p.shares.toLocaleString()} sh @ ${p.currentPrice.toFixed(2)}g (P&L: ${sign}${p.pnl.toFixed(2)}g / ${sign}${p.pnlPercent.toFixed(1)}%)\n`;
      });
    }

    const pnlSign = totalUnrealizedPnl >= 0 ? "+" : "";
    const flexText = 
`🏆 ${username}${parlamentumName}'s Portfolio on Grow UR Gold:
💰 Net Worth: ${totalNetWorth.toFixed(2)} gold
📈 Total P&L: ${pnlSign}${totalUnrealizedPnl.toFixed(2)} gold (${pnlSign}${totalRoiPercent.toFixed(1)}% ROI)
🪙 Liquid Purse: ${cashBalance.toFixed(2)} gold
📊 Equities Held:
${holdingsText}
💎 Trade live: https://growurgold.vercel.app/portfolio`;

    navigator.clipboard.writeText(flexText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const isProfitable = totalUnrealizedPnl >= 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/90 via-zinc-950/90 to-zinc-950 p-5 sm:p-6 shadow-2xl backdrop-blur">
      {/* Decorative ambient gradient */}
      <div 
        className={`pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl opacity-20 ${
          isProfitable ? "bg-emerald-500" : "bg-rose-500"
        }`} 
      />

      <div className="flex flex-col gap-5">
        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isProfitable ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/15 text-rose-400 border border-rose-500/30"}`}>
              {isProfitable ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Investor Performance & P&L
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Sparkles className="w-2.5 h-2.5" /> Live
                </span>
              </div>
              <h2 className="text-sm text-zinc-300 font-medium mt-0.5">
                Real-Time Equity Returns on parlamentum.org
              </h2>
            </div>
          </div>

          {/* Flex Bag Share Button */}
          <button
            type="button"
            onClick={handleCopyFlexBag}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-lg cursor-pointer ${
              copied
                ? "bg-emerald-500 text-black border border-emerald-400"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
            }`}
            title="Copy shareable portfolio breakdown for Discord or in-game chat"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Flex My Bag</span>
              </>
            )}
          </button>
        </div>

        {/* Primary Numbers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Unrealized P&L */}
          <div className={`p-4 rounded-xl border flex flex-col justify-between ${
            isProfitable 
              ? "bg-emerald-950/20 border-emerald-500/30 shadow-emerald-950/20" 
              : "bg-rose-950/20 border-rose-500/30 shadow-rose-950/20"
          }`}>
            <span className="text-xs font-medium text-zinc-400">Total Unrealized P&L</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                isProfitable ? "text-emerald-400" : "text-rose-400"
              }`}>
                {totalUnrealizedPnl >= 0 ? "+" : ""}{totalUnrealizedPnl.toFixed(2)}
                <span className="text-sm font-sans font-bold ml-1">gold</span>
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold ${
                isProfitable 
                  ? "bg-emerald-500/20 text-emerald-300" 
                  : "bg-rose-500/20 text-rose-300"
              }`}>
                {isProfitable ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {totalRoiPercent >= 0 ? "+" : ""}{totalRoiPercent.toFixed(2)}% ROI
              </span>
              <span className="text-[11px] text-zinc-400">on invested capital</span>
            </div>
          </div>

          {/* 2. Capital Invested vs Valuation */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 flex flex-col justify-between">
            <span className="text-xs font-medium text-zinc-400">Capital Invested (Cost Basis)</span>
            <div className="mt-2">
              <span className="text-2xl font-bold font-mono text-zinc-100">
                {totalCostBasis.toFixed(2)}
                <span className="text-sm font-sans font-normal text-zinc-400 ml-1">gold</span>
              </span>
            </div>
            <div className="mt-2 text-xs text-zinc-400 flex items-center justify-between">
              <span>Market Value:</span>
              <span className="font-mono font-semibold text-zinc-200">
                {totalStockValue.toFixed(2)} gold
              </span>
            </div>
          </div>

          {/* 3. Liquid Gold & Locked Orders */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 flex flex-col justify-between">
            <span className="text-xs font-medium text-zinc-400">Liquid Purse & Purchasing Power</span>
            <div className="mt-2">
              <span className="text-2xl font-bold font-mono text-amber-300">
                {cashBalance.toFixed(2)}
                <span className="text-sm font-sans font-normal text-zinc-400 ml-1">gold</span>
              </span>
            </div>
            <div className="mt-2 text-xs text-zinc-400 flex items-center justify-between">
              <span>In Limit Bids:</span>
              <span className="font-mono text-zinc-300">
                {lockedCash.toFixed(2)} gold
              </span>
            </div>
          </div>

          {/* 4. Total Dividends & Yield */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 flex flex-col justify-between">
            <span className="text-xs font-medium text-zinc-400">Dividends Collected</span>
            <div className="mt-2">
              <span className="text-2xl font-bold font-mono text-emerald-400">
                +{totalDividendsEarned.toFixed(2)}
                <span className="text-sm font-sans font-normal text-zinc-400 ml-1">gold</span>
              </span>
            </div>
            <div className="mt-2 text-xs text-zinc-400 flex items-center justify-between">
              <span>Friday Drops:</span>
              <span className="font-mono text-zinc-300">Active</span>
            </div>
          </div>
        </div>

        {/* Highlights Bar */}
        {(bestPerformer || worstPerformer) && (
          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs border-t border-zinc-800/60">
            {bestPerformer && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Award className="w-3.5 h-3.5" />
                <span className="font-semibold">Top Winner:</span>
                <span className="font-mono font-bold">${bestPerformer.ticker} (+{bestPerformer.pnlPercent.toFixed(1)}%)</span>
                <span className="text-zinc-400 ml-1">(+{bestPerformer.pnl.toFixed(2)}g)</span>
              </div>
            )}
            {worstPerformer && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <TrendingDown className="w-3.5 h-3.5" />
                <span className="font-semibold">Laggard:</span>
                <span className="font-mono font-bold">${worstPerformer.ticker} ({worstPerformer.pnlPercent.toFixed(1)}%)</span>
                <span className="text-zinc-400 ml-1">({worstPerformer.pnl.toFixed(2)}g)</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
