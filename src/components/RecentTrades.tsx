"use client";

import { TradeItem } from "@/lib/market";

interface RecentTradesProps {
  trades: TradeItem[];
}

export default function RecentTrades({ trades = [] }: RecentTradesProps) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex flex-col text-xs font-mono select-none">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 text-[11px] font-sans font-semibold text-zinc-400">
        <span>Recent Market Fills</span>
        <span className="text-[10px] text-zinc-400 font-mono">Real-time</span>
      </div>

      <div className="grid grid-cols-4 text-[10px] text-zinc-400 font-sans py-1.5 border-b border-zinc-800/40">
        <span>Time</span>
        <span className="text-right">Price (Gold)</span>
        <span className="text-right">Quantity</span>
        <span className="text-right">Total (Gold)</span>
      </div>

      <div className="flex flex-col gap-0.5 py-1 max-h-[220px] overflow-y-auto scrollbar-thin">
        {trades.length === 0 ? (
          <div className="text-center py-6 text-zinc-400 text-[11px] font-sans">
            No recent trades executed yet
          </div>
        ) : (
          trades.map((trade, idx) => {
            const timeStr = trade.timestamp.includes("T")
              ? trade.timestamp.split("T")[1]?.slice(0, 8)
              : trade.timestamp.slice(-8);

            const isBuy = trade.type === "BUY";

            return (
              <div
                key={trade.id || idx}
                className="grid grid-cols-4 py-0.5 px-1 rounded hover:bg-zinc-800/50 text-[11px]"
              >
                <span className="text-zinc-400">{timeStr}</span>
                <span className={`text-right font-bold ${isBuy ? "text-emerald-400" : "text-rose-400"}`}>
                  {trade.price.toFixed(2)}
                </span>
                <span className="text-right text-zinc-300">
                  {trade.quantity.toLocaleString()}
                </span>
                <span className="text-right text-zinc-400">
                  {trade.total.toFixed(0)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
