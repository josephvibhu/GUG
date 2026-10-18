"use client";

import { useMemo } from "react";
import { OrderBookData } from "@/lib/market";

interface OrderBookProps {
  orderBook: OrderBookData;
  ticker: string;
  onSelectPrice: (price: number) => void;
}

export default function OrderBook({ orderBook, ticker, onSelectPrice }: OrderBookProps) {
  const { bids = [], asks = [], spread = 0, spreadPercent = 0, lastPrice = 0 } = orderBook || {};

  // For visual depth bars
  const maxCumVolume = useMemo(() => {
    const maxBid = bids.length > 0 ? bids[bids.length - 1].cumulativeTotal : 0;
    const maxAsk = asks.length > 0 ? asks[asks.length - 1].cumulativeTotal : 0;
    return Math.max(maxBid, maxAsk, 100);
  }, [bids, asks]);

  // Display top 8 asks in reversed order (highest price at top, lowest ask near the spread)
  const displayAsks = useMemo(() => {
    return [...asks].slice(0, 8).reverse();
  }, [asks]);

  // Display top 8 bids
  const displayBids = useMemo(() => {
    return [...bids].slice(0, 8);
  }, [bids]);

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex flex-col text-xs font-mono select-none">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 text-[11px] font-sans font-semibold text-zinc-400">
        <span>Order Book</span>
        <span className="text-[10px] text-zinc-400 font-mono">Depth (Total)</span>
      </div>

      {/* Table Headers */}
      <div className="grid grid-cols-3 text-[10px] text-zinc-400 font-sans py-1.5 border-b border-zinc-800/40">
        <span className="text-left">Price (Gold)</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (Sells) */}
      <div className="flex flex-col gap-0.5 py-1 min-h-[160px] justify-end">
        {displayAsks.length === 0 ? (
          <div className="text-center py-4 text-zinc-400 text-[11px] font-sans">
            No active ask orders
          </div>
        ) : (
          displayAsks.map((ask, i) => {
            const depthPercent = Math.min(100, Math.round((ask.cumulativeTotal / maxCumVolume) * 100));
            return (
              <div
                key={`ask-${i}`}
                onClick={() => onSelectPrice(ask.price)}
                className="relative grid grid-cols-3 py-0.5 px-1 rounded hover:bg-rose-500/10 cursor-pointer group transition"
              >
                {/* Red Depth Bar Background */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-rose-500/15 rounded-r pointer-events-none transition-all duration-300"
                  style={{ width: `${depthPercent}%` }}
                />
                <span className="relative text-rose-400 font-bold group-hover:underline">
                  {ask.price.toFixed(2)}
                </span>
                <span className="relative text-right text-zinc-300">
                  {ask.quantity.toLocaleString()}
                </span>
                <span className="relative text-right text-zinc-400">
                  {ask.cumulativeTotal.toLocaleString()}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Spread & Last Price Bar */}
      <div className="my-1.5 py-1.5 px-2 bg-zinc-950/80 border-y border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">
            {lastPrice.toFixed(2)} <span className="text-[10px] font-normal text-zinc-400">gold</span>
          </span>
          <span className="text-[10px] text-zinc-400 uppercase font-sans">Market</span>
        </div>
        <div className="text-[11px] text-zinc-400">
          Spread: <span className="text-zinc-300">{spread.toFixed(2)} gold</span> ({spreadPercent}%)
        </div>
      </div>

      {/* Bids (Buys) */}
      <div className="flex flex-col gap-0.5 py-1 min-h-[160px]">
        {displayBids.length === 0 ? (
          <div className="text-center py-4 text-zinc-400 text-[11px] font-sans">
            No active bid orders
          </div>
        ) : (
          displayBids.map((bid, i) => {
            const depthPercent = Math.min(100, Math.round((bid.cumulativeTotal / maxCumVolume) * 100));
            return (
              <div
                key={`bid-${i}`}
                onClick={() => onSelectPrice(bid.price)}
                className="relative grid grid-cols-3 py-0.5 px-1 rounded hover:bg-emerald-500/10 cursor-pointer group transition"
              >
                {/* Green Depth Bar Background */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 rounded-r pointer-events-none transition-all duration-300"
                  style={{ width: `${depthPercent}%` }}
                />
                <span className="relative text-emerald-400 font-bold group-hover:underline">
                  {bid.price.toFixed(2)}
                </span>
                <span className="relative text-right text-zinc-300">
                  {bid.quantity.toLocaleString()}
                </span>
                <span className="relative text-right text-zinc-400">
                  {bid.cumulativeTotal.toLocaleString()}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
