"use client";

import { useState, useEffect } from "react";
import { Company, PortfolioPosition } from "@/lib/market";

interface TradeFormProps {
  company: Company;
  userHolding: PortfolioPosition | null;
  userCash: number;
  selectedPrice: number | null;
  marketSchedule?: { isOpen: boolean; statusText: string } | null;
  onTradeSuccess: () => void;
}

export default function TradeForm({
  company,
  userHolding,
  userCash,
  selectedPrice,
  marketSchedule,
  onTradeSuccess,
}: TradeFormProps) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [price, setPrice] = useState<string>(company.currentPrice.toString());
  const [quantity, setQuantity] = useState<string>("10");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // When selectedPrice changes from OrderBook click, update input
  useEffect(() => {
    if (selectedPrice && orderType === "LIMIT") {
      setPrice(selectedPrice.toFixed(2));
    }
  }, [selectedPrice, orderType]);

  const numPrice = orderType === "LIMIT" ? parseFloat(price) || 0 : company.currentPrice;
  const numQty = parseInt(quantity, 10) || 0;
  const totalCost = Math.round(numPrice * numQty * 100) / 100;

  const availableShares = userHolding ? userHolding.availableShares : 0;

  // Percentage quick-pick helper
  const handlePercentPick = (percent: number) => {
    if (side === "BUY") {
      if (numPrice <= 0) return;
      const maxAffordable = Math.floor((userCash * (percent / 100)) / numPrice);
      setQuantity(Math.max(1, maxAffordable).toString());
    } else {
      const sellQty = Math.floor(availableShares * (percent / 100));
      setQuantity(Math.max(0, sellQty).toString());
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (numQty <= 0) {
      setFeedback({ type: "error", message: "Enter a valid share quantity" });
      return;
    }

    if (orderType === "LIMIT" && numPrice <= 0) {
      setFeedback({ type: "error", message: "Enter a valid limit price" });
      return;
    }

    if (side === "BUY" && totalCost > userCash) {
      setFeedback({ type: "error", message: `Insufficient funds. Required: Ᵽ${totalCost.toFixed(2)}, Available: Ᵽ${userCash.toFixed(2)}` });
      return;
    }

    if (side === "SELL" && numQty > availableShares) {
      setFeedback({ type: "error", message: `Insufficient shares. You have ${availableShares} shares available.` });
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          type: side,
          orderType,
          price: numPrice,
          quantity: numQty,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        onTradeSuccess();
      } else {
        setFeedback({ type: "error", message: data.message || "Order rejected by matching engine" });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to communicate with exchange" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col text-xs font-sans">
      {/* Side Switcher: BUY / SELL */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-950 rounded-lg border border-zinc-800 mb-3">
        <button
          type="button"
          onClick={() => {
            setSide("BUY");
            setFeedback(null);
          }}
          className={`py-2 text-center font-bold rounded-md transition cursor-pointer text-xs ${
            side === "BUY"
              ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          BUY ${company.ticker}
        </button>
        <button
          type="button"
          onClick={() => {
            setSide("SELL");
            setFeedback(null);
          }}
          className={`py-2 text-center font-bold rounded-md transition cursor-pointer text-xs ${
            side === "SELL"
              ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          SELL ${company.ticker}
        </button>
      </div>

      {/* Order Type Tabs: Limit / Market */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setOrderType("LIMIT")}
          className={`px-3 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
            orderType === "LIMIT"
              ? "bg-zinc-800 text-amber-300 border border-amber-500/30"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Limit Order
        </button>
        <button
          type="button"
          onClick={() => setOrderType("MARKET")}
          className={`px-3 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
            orderType === "MARKET"
              ? "bg-zinc-800 text-amber-300 border border-amber-500/30"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Market Order
        </button>
      </div>

      <form onSubmit={handleSubmitOrder} className="flex flex-col gap-3">
        {/* Price Input (if LIMIT) */}
        {orderType === "LIMIT" ? (
          <div>
            <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
              <span>Limit Price</span>
              <span className="font-mono text-zinc-300">Last: {company.currentPrice.toFixed(2)} gold</span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2 font-mono text-zinc-400 text-xs">gold</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg pl-11 pr-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        ) : (
          <div className="p-2.5 bg-zinc-950/60 rounded-lg border border-zinc-800 text-[11px] text-zinc-400">
            Market orders execute instantly at the best available prices on the order book.
          </div>
        )}

        {/* Quantity Input */}
        <div>
          <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
            <span>Share Quantity</span>
            <span className="font-mono text-zinc-300">
              {side === "BUY" ? (
                <>Max: {numPrice > 0 ? Math.floor(userCash / numPrice) : 0}</>
              ) : (
                <>Available: {availableShares}</>
              )}
            </span>
          </div>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Percentage Quick Pickers */}
        <div className="grid grid-cols-4 gap-1.5">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => handlePercentPick(pct)}
              className="py-1 text-[10px] font-mono bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition cursor-pointer"
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Total Cost / Proceeds Preview */}
        <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800/80 flex flex-col gap-1 text-[11px]">
          <div className="flex justify-between text-zinc-400">
            <span>Estimated Total:</span>
            <span className="font-mono font-bold text-white text-xs">
              {totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gold
            </span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>{side === "BUY" ? "Available Purse:" : "Available Shares:"}</span>
            <span className="font-mono text-zinc-300">
              {side === "BUY" ? `${userCash.toFixed(0)} gold` : `${availableShares} shares`}
            </span>
          </div>
        </div>

        {/* Company Halted or Defaulted Warning */}
        {company.status && company.status !== "ACTIVE" && (
          <div className="p-2.5 rounded-lg text-[11px] bg-amber-950/60 border border-amber-600/40 text-amber-300 leading-relaxed flex flex-col gap-0.5">
            <span className="font-bold flex items-center gap-1.5 text-amber-400">
              ⏸️ Trading {company.status === "HALTED" ? "Halted" : "Suspended (Default)"}
            </span>
            <span className="text-zinc-300">
              {company.status === "HALTED" 
                ? "The Exchange Operator has temporarily halted trading for this company." 
                : "This company has been flagged as defaulted. Trading is suspended."}
            </span>
          </div>
        )}

        {/* Floor Closed Warning */}
        {marketSchedule && !marketSchedule.isOpen && (
          <div className="p-2.5 rounded-lg text-[11px] bg-rose-950/60 border border-rose-600/40 text-rose-300 leading-relaxed flex flex-col gap-0.5">
            <span className="font-bold flex items-center gap-1.5 text-rose-400">
              🔴 Trading Floor Closed
            </span>
            <span className="text-zinc-300">
              {marketSchedule.statusText}
            </span>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-2.5 rounded-lg text-[11px] border leading-relaxed ${
              feedback.type === "success"
                ? "bg-emerald-950/60 border-emerald-600/40 text-emerald-300"
                : "bg-rose-950/60 border-rose-600/40 text-rose-300"
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Action Button */}
        <button
          type="submit"
          disabled={isLoading || (marketSchedule ? !marketSchedule.isOpen : false) || (company.status && company.status !== "ACTIVE")}
          className={`w-full py-2.5 rounded-lg font-bold text-sm tracking-wide transition shadow-lg ${
            (company.status && company.status !== "ACTIVE") || (marketSchedule && !marketSchedule.isOpen)
              ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
              : side === "BUY"
              ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20 cursor-pointer"
              : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20 cursor-pointer"
          } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {company.status && company.status !== "ACTIVE"
            ? `Trading ${company.status} · Order Blocked`
            : marketSchedule && !marketSchedule.isOpen
            ? "Floor Closed · Order Blocked"
            : isLoading
            ? "Executing Order..."
            : side === "BUY"
            ? `Buy ${numQty} $${company.ticker}`
            : `Sell ${numQty} $${company.ticker}`}
        </button>
      </form>
    </div>
  );
}
