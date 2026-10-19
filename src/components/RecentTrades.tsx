"use client";

import { memo } from "react";
import { TradeItem } from "@/lib/market";
import { fmtPrice, fmtQty, fmtUtcTime } from "@/lib/format";

/** The trade tape: newest first, price coloured by the side that took the order */
function RecentTradesImpl({ trades = [], showTitle = true }: { trades: TradeItem[]; showTitle?: boolean }) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {showTitle && (
        <div className="h-9 shrink-0 px-3 flex items-center justify-between border-b border-rule">
          <h2 className="text-[13px] font-semibold text-zinc-50">Trades</h2>
          <span className="text-[11px] text-ash">UTC</span>
        </div>
      )}
      <div className="grid grid-cols-[1fr_1fr_1fr] px-3 h-7 items-center text-[11px] text-ash">
        <span>Price</span>
        <span className="text-right">Shares</span>
        <span className="text-right">Time</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto max-h-[420px]">
        {trades.length === 0 ? (
          <p className="px-3 py-3 text-[12px] text-ash">No trades yet.</p>
        ) : (
          trades.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_1fr_1fr] px-3 h-[22px] items-center text-[12px]">
              <span className={t.type === "SELL" ? "text-bear" : "text-bull"}>{fmtPrice(t.price)}</span>
              <span className="text-right text-paper">{fmtQty(t.quantity)}</span>
              <span className="text-right text-ash">{fmtUtcTime(t.timestamp)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default memo(RecentTradesImpl);
