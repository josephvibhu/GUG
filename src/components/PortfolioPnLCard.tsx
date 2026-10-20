"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { fmtGold, fmtPct, moveColor } from "@/lib/format";
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

// Best and worst holdings, and a portfolio summary to paste into Discord or the game chat
export default function PortfolioPnLCard({ user, positions, cashBalance, totalStockValue, totalNetWorth }: PortfolioPnLCardProps) {
  const [copied, setCopied] = useState(false);

  const totalCostBasis = positions.reduce((sum, p) => sum + p.costBasis, 0);
  const totalUnrealizedPnl = Math.round((totalStockValue - totalCostBasis) * 100) / 100;
  const totalRoiPercent = totalCostBasis > 0 ? Math.round(((totalStockValue - totalCostBasis) / totalCostBasis) * 10000) / 100 : 0;

  const sortedByRoi = [...positions].sort((a, b) => b.pnlPercent - a.pnlPercent);
  const best = sortedByRoi.length > 0 && sortedByRoi[0].pnlPercent > 0 ? sortedByRoi[0] : null;
  const worst = sortedByRoi.length > 1 && sortedByRoi[sortedByRoi.length - 1].pnlPercent < 0 ? sortedByRoi[sortedByRoi.length - 1] : null;

  const copySummary = async () => {
    const username = user?.displayName || user?.username || "Citizen";
    const inGame = user?.parlamentumName ? ` (@${user.parlamentumName})` : "";
    const sign = totalUnrealizedPnl >= 0 ? "+" : "";
    const holdings = positions.length
      ? positions
          .map((p) => {
            const s = p.pnl >= 0 ? "+" : "";
            return `• $${p.ticker}: ${p.shares.toLocaleString()} sh @ ${p.currentPrice.toFixed(2)}g (${s}${p.pnl.toFixed(2)}g / ${s}${p.pnlPercent.toFixed(1)}%)`;
          })
          .join("\n")
      : "• All in gold";
    const text = `🏆 ${username}${inGame}'s portfolio on Grow Ur Gold
💰 Net worth: ${totalNetWorth.toFixed(2)} gold
📈 Unrealized: ${sign}${totalUnrealizedPnl.toFixed(2)} gold (${sign}${totalRoiPercent.toFixed(1)}%)
🪙 Purse: ${cashBalance.toFixed(2)} gold
${holdings}
${window.location.origin}/portfolio`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[13px]">
      <dl className="flex flex-wrap gap-x-6 gap-y-1">
        <div className="flex gap-2">
          <dt className="text-ash">Invested</dt>
          <dd className="tabular text-paper">{fmtGold(totalCostBasis)} gold</dd>
        </div>
        {best && (
          <div className="flex gap-2">
            <dt className="text-ash">Best</dt>
            <dd className="tabular">
              <span className="condensed font-bold text-zinc-50">{best.ticker}</span> <span className={moveColor(best.pnlPercent)}>{fmtPct(best.pnlPercent)}</span>
            </dd>
          </div>
        )}
        {worst && (
          <div className="flex gap-2">
            <dt className="text-ash">Worst</dt>
            <dd className="tabular">
              <span className="condensed font-bold text-zinc-50">{worst.ticker}</span> <span className={moveColor(worst.pnlPercent)}>{fmtPct(worst.pnlPercent)}</span>
            </dd>
          </div>
        )}
      </dl>
      <button
        type="button"
        onClick={copySummary}
        className="h-8 px-3 rounded-[4px] border border-rule hover:border-zinc-500 text-[12px] text-paper flex items-center gap-1.5"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-bull" /> : <Copy className="h-3.5 w-3.5 text-ash" />}
        {copied ? "Copied" : "Copy summary for Discord"}
      </button>
    </div>
  );
}
