"use client";

import { memo, useMemo } from "react";
import { OrderBookData } from "@/lib/market";
import { fmtPrice, fmtQty } from "@/lib/format";

interface OrderBookProps {
  orderBook: OrderBookData;
  ticker: string;
  lastDirection: "up" | "down" | "flat";
  onSelectPrice: (price: number) => void;
  showTitle?: boolean;
}

const LEVELS = 9;

function OrderBookImpl({ orderBook, lastDirection, onSelectPrice, showTitle = true }: OrderBookProps) {
  const { bids = [], asks = [], spread = 0, spreadPercent = 0, lastPrice = 0 } = orderBook || {};

  const maxCum = useMemo(
    () => Math.max(bids[Math.min(bids.length, LEVELS) - 1]?.cumulativeTotal || 0, asks[Math.min(asks.length, LEVELS) - 1]?.cumulativeTotal || 0, 1),
    [bids, asks]
  );
  // Best ask sits next to the spread, so asks are listed highest first
  const shownAsks = useMemo(() => asks.slice(0, LEVELS).reverse(), [asks]);
  const shownBids = useMemo(() => bids.slice(0, LEVELS), [bids]);

  const row = (level: { price: number; quantity: number; cumulativeTotal: number }, side: "ask" | "bid") => (
    <button
      key={`${side}-${level.price}`}
      type="button"
      onClick={() => onSelectPrice(level.price)}
      title={`Use ${fmtPrice(level.price)} as the order price`}
      className="relative w-full grid grid-cols-[1fr_1fr_1fr] h-[22px] items-center px-3 text-[12px] hover:bg-pane text-left"
    >
      <span
        className={`absolute inset-y-[2px] right-0 ${side === "ask" ? "bg-bear/12" : "bg-bull/12"}`}
        style={{ width: `${Math.min(100, (level.cumulativeTotal / maxCum) * 100)}%` }}
        aria-hidden
      />
      <span className={`relative ${side === "ask" ? "text-bear" : "text-bull"}`}>{fmtPrice(level.price)}</span>
      <span className="relative text-right text-paper">{fmtQty(level.quantity)}</span>
      <span className="relative text-right text-ash">{fmtQty(level.cumulativeTotal)}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {showTitle && (
        <div className="h-9 shrink-0 px-3 flex items-center justify-between border-b border-rule">
          <h2 className="text-[13px] font-semibold text-zinc-50">Order book</h2>
        </div>
      )}
      <div className="grid grid-cols-[1fr_1fr_1fr] px-3 h-7 items-center text-[11px] text-ash">
        <span>Price</span>
        <span className="text-right">Shares</span>
        <span className="text-right">Total</span>
      </div>

      <div className="flex flex-col justify-end min-h-[198px]">
        {shownAsks.length === 0 ? <p className="px-3 py-3 text-[12px] text-ash">No sell orders.</p> : shownAsks.map((a) => row(a, "ask"))}
      </div>

      <div className="h-10 px-3 flex items-center justify-between border-y border-rule">
        <span className={`condensed text-[17px] font-bold ${lastDirection === "up" ? "text-bull" : lastDirection === "down" ? "text-bear" : "text-zinc-50"}`}>
          {fmtPrice(lastPrice)}
        </span>
        <span className="text-[11px] text-ash">
          Spread {fmtPrice(spread)} <span className="text-zinc-500">({spreadPercent}%)</span>
        </span>
      </div>

      <div className="flex flex-col min-h-[198px]">
        {shownBids.length === 0 ? <p className="px-3 py-3 text-[12px] text-ash">No buy orders.</p> : shownBids.map((b) => row(b, "bid"))}
      </div>
    </div>
  );
}

export default memo(OrderBookImpl);
