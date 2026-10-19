"use client";

import { useState } from "react";
import Link from "next/link";
import { Company, PortfolioPosition } from "@/lib/market";
import { fmtPrice, fmtQty, fmtGold } from "@/lib/format";

interface TradeFormProps {
  company: Company;
  userHolding: PortfolioPosition | null;
  userCash: number;
  loggedIn: boolean;
  selectedPrice: number | null;
  marketSchedule?: { isOpen: boolean; statusText: string } | null;
  onTradeSuccess: () => void;
}

export default function TradeForm({
  company,
  userHolding,
  userCash,
  loggedIn,
  selectedPrice,
  marketSchedule,
  onTradeSuccess,
}: TradeFormProps) {
  const [mode, setMode] = useState<"BASIC" | "ADVANCED">("BASIC");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET">("MARKET");
  const [price, setPrice] = useState<string>(company.currentPrice.toFixed(2));
  const [quantity, setQuantity] = useState<string>("10");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // A click on an order-book level fills in that price (adjusted during render, no effect needed)
  const [seenPrice, setSeenPrice] = useState(selectedPrice);
  if (selectedPrice !== seenPrice) {
    setSeenPrice(selectedPrice);
    if (selectedPrice) {
      setOrderType("LIMIT");
      setPrice(selectedPrice.toFixed(2));
    }
  }

  const numPrice = orderType === "LIMIT" ? parseFloat(price) || 0 : company.currentPrice;
  const numQty = parseInt(quantity, 10) || 0;
  const totalCost = Math.round(numPrice * numQty * 100) / 100;
  // The server escrows market buys at the last price + 5%, so size and check them against that
  const escrowPrice = side === "BUY" && orderType === "MARKET" ? numPrice * 1.05 : numPrice;
  const requiredCash = Math.round(escrowPrice * numQty * 100) / 100;

  const availableShares = userHolding ? userHolding.availableShares : 0;
  const floorClosed = marketSchedule ? !marketSchedule.isOpen : false;
  const notTrading = company.status && company.status !== "ACTIVE";
  const blocked = floorClosed || notTrading;

  const handlePercentPick = (percent: number) => {
    if (side === "BUY") {
      if (numPrice <= 0) return;
      const maxAffordable = Math.floor((userCash * (percent / 100)) / escrowPrice);
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
      setFeedback({ type: "error", message: "Enter how many shares." });
      return;
    }
    if (orderType === "LIMIT" && numPrice <= 0) {
      setFeedback({ type: "error", message: "Enter a price above 0." });
      return;
    }
    if (side === "BUY" && requiredCash > userCash) {
      setFeedback({ type: "error", message: `Not enough gold: this order needs ${fmtPrice(requiredCash)}, your purse has ${fmtPrice(userCash)}.` });
      return;
    }
    if (side === "SELL" && numQty > availableShares) {
      setFeedback({ type: "error", message: `You have ${fmtQty(availableShares)} shares free to sell.` });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, type: side, orderType, price: numPrice, quantity: numQty }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        onTradeSuccess();
      } else {
        setFeedback({ type: "error", message: data.message || "The exchange rejected the order." });
      }
    } catch {
      setFeedback({ type: "error", message: "Couldn't reach the exchange. Check your connection and try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const fieldClass =
    "w-full h-9 rounded-[4px] border border-rule bg-floor pl-3 pr-14 text-right text-[14px] text-zinc-50 focus:outline-none focus:border-zinc-500";

  if (!loggedIn) {
    return (
      <div className="p-4 flex flex-col gap-3">
        <h2 className="text-[13px] font-semibold text-zinc-50">Trade {company.ticker}</h2>
        <p className="text-[13px] text-ash">Log in to buy and sell shares. Your purse holds the gold you deposit from Parlamentum.</p>
        <Link href="/login" className="h-9 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor text-[13px] font-semibold flex items-center justify-center">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitOrder} className="p-3 flex flex-col gap-3 text-[13px]">
      {/* Mode Switcher: Basic (Quick Clickable) vs Advanced (Pro Ticket) */}
      <div className="flex items-center justify-between pb-1 border-b border-rule">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ash">Mode</span>
        <div className="flex bg-pane p-0.5 rounded-[4px] text-[11px] font-medium border border-rule">
          <button
            type="button"
            onClick={() => {
              setMode("BASIC");
              setOrderType("MARKET");
              setFeedback(null);
            }}
            className={`px-2.5 py-0.5 rounded-[3px] transition cursor-pointer flex items-center gap-1 ${
              mode === "BASIC"
                ? "bg-bullion text-floor font-bold shadow-sm"
                : "text-ash hover:text-paper"
            }`}
          >
            ⚡ Basic
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("ADVANCED");
              setFeedback(null);
            }}
            className={`px-2.5 py-0.5 rounded-[3px] transition cursor-pointer flex items-center gap-1 ${
              mode === "ADVANCED"
                ? "bg-zinc-700 text-white font-bold shadow-sm"
                : "text-ash hover:text-paper"
            }`}
          >
            ⚙️ Advanced
          </button>
        </div>
      </div>

      {/* Buy / Sell Selector */}
      <div className="grid grid-cols-2 gap-0.5 p-0.5 rounded-[4px] bg-pane" role="group" aria-label="Side">
        {(["BUY", "SELL"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={side === s}
            onClick={() => {
              setSide(s);
              setFeedback(null);
            }}
            className={`h-8 rounded-[3px] font-semibold transition-colors cursor-pointer ${
              side === s ? (s === "BUY" ? "bg-bull text-floor" : "bg-bear text-white") : "text-ash hover:text-paper"
            }`}
          >
            {s === "BUY" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      {/* BASIC MODE: Simplified, clickable access without complex inputs */}
      {mode === "BASIC" ? (
        <div className="flex flex-col gap-3">
          {/* Price display banner */}
          <div className="p-2.5 rounded-[4px] bg-pane border border-rule flex items-center justify-between text-xs">
            <span className="text-ash">{side === "BUY" ? "Market Execution Price" : "Current Selling Price"}</span>
            <span className="font-bold text-zinc-50 font-mono">
              {fmtPrice(company.currentPrice)} gold <span className="text-[11px] font-normal text-ash">/ share</span>
            </span>
          </div>

          {/* Quick Clickable Share Amount Selector with Stepper */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[12px] text-ash">
              <span>Shares to trade</span>
              <span>
                {side === "BUY"
                  ? `Max: ${fmtQty(numPrice > 0 ? Math.floor(userCash / escrowPrice) : 0)}`
                  : `Owned: ${fmtQty(availableShares)}`}
              </span>
            </div>

            {/* Stepper with - / count / + */}
            <div className="flex items-center justify-between bg-floor border border-rule rounded-[4px] p-1">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, (parseInt(quantity, 10) || 1) - 1).toString())}
                className="w-9 h-8 rounded-[3px] bg-pane hover:bg-zinc-700 text-zinc-100 font-bold text-base flex items-center justify-center transition cursor-pointer"
                aria-label="Decrease quantity"
              >
                -
              </button>
              <div className="flex items-center gap-1 font-mono font-bold text-zinc-50 text-sm">
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-16 text-center bg-transparent focus:outline-none"
                />
                <span className="text-[12px] font-normal text-ash font-sans">shares</span>
              </div>
              <button
                type="button"
                onClick={() => setQuantity(((parseInt(quantity, 10) || 0) + 1).toString())}
                className="w-9 h-8 rounded-[3px] bg-pane hover:bg-zinc-700 text-zinc-100 font-bold text-base flex items-center justify-center transition cursor-pointer"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            {/* Clickable Quick Share Bundles */}
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="grid grid-cols-4 gap-1">
                {[1, 5, 10, 25].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuantity(preset.toString())}
                    className={`h-7 rounded-[3px] border text-[11px] font-mono transition cursor-pointer ${
                      quantity === preset.toString()
                        ? "border-bullion text-bullion bg-bullion/10 font-bold"
                        : "border-rule text-ash hover:text-paper hover:border-zinc-600 bg-pane"
                    }`}
                  >
                    +{preset}
                  </button>
                ))}
              </div>

              {/* Quick Percentages */}
              <div className="grid grid-cols-3 gap-1">
                {side === "BUY" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handlePercentPick(25)}
                      className="h-7 rounded-[3px] border border-rule text-[11px] text-ash hover:text-paper hover:border-zinc-600 bg-pane transition cursor-pointer"
                    >
                      25% Purse
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePercentPick(50)}
                      className="h-7 rounded-[3px] border border-rule text-[11px] text-ash hover:text-paper hover:border-zinc-600 bg-pane transition cursor-pointer"
                    >
                      50% Purse
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePercentPick(100)}
                      className="h-7 rounded-[3px] border border-bullion/50 text-[11px] font-bold text-bullion hover:border-bullion bg-bullion/10 transition cursor-pointer"
                    >
                      Max Buy
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handlePercentPick(25)}
                      className="h-7 rounded-[3px] border border-rule text-[11px] text-ash hover:text-paper hover:border-zinc-600 bg-pane transition cursor-pointer"
                    >
                      25%
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePercentPick(50)}
                      className="h-7 rounded-[3px] border border-rule text-[11px] text-ash hover:text-paper hover:border-zinc-600 bg-pane transition cursor-pointer"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePercentPick(100)}
                      className="h-7 rounded-[3px] border border-bear/50 text-[11px] font-bold text-bear hover:border-bear bg-bear/10 transition cursor-pointer"
                    >
                      All ({fmtQty(availableShares)})
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Simple summary card */}
          <div className="p-2.5 rounded-[4px] bg-pane/70 border border-rule space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-ash">{side === "BUY" ? "Estimated Total Cost:" : "Estimated Total Payout:"}</span>
              <strong className="text-zinc-50 font-mono text-sm">{fmtPrice(totalCost)} gold</strong>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-ash">{side === "BUY" ? "Your Purse Balance:" : "Shares Available to Sell:"}</span>
              <span className="text-paper font-mono">
                {side === "BUY" ? `${fmtGold(userCash)} gold` : `${fmtQty(availableShares)} shares`}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ADVANCED MODE: Professional order ticket with Limit / Market and exact price */
        <>
          <div className="flex gap-4 border-b border-rule" role="group" aria-label="Order type">
            {(["LIMIT", "MARKET"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={orderType === t}
                onClick={() => setOrderType(t)}
                className={`-mb-px pb-2 border-b-2 transition-colors cursor-pointer ${
                  orderType === t ? "text-zinc-50 border-zinc-50" : "text-ash border-transparent hover:text-paper"
                }`}
              >
                {t === "LIMIT" ? "Limit" : "Market"}
              </button>
            ))}
          </div>

          {orderType === "LIMIT" ? (
            <label className="flex flex-col gap-1">
              <span className="flex justify-between text-[12px] text-ash">
                Price
                <button type="button" onClick={() => setPrice(company.currentPrice.toFixed(2))} className="hover:text-paper cursor-pointer">
                  Last {fmtPrice(company.currentPrice)}
                </button>
              </span>
              <span className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={fieldClass}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ash pointer-events-none">gold</span>
              </span>
            </label>
          ) : (
            <p className="text-[12px] text-ash leading-relaxed">
              {side === "BUY"
                ? `Buys at the best asks up to ${fmtPrice(company.currentPrice * 1.05)} (last price + 5%). Anything left is cancelled.`
                : "Sells at the best bids on the book. Anything left is cancelled."}
            </p>
          )}

          <label className="flex flex-col gap-1">
            <span className="flex justify-between text-[12px] text-ash">
              Shares
              <span>
                {side === "BUY"
                  ? `Up to ${fmtQty(numPrice > 0 ? Math.floor(userCash / escrowPrice) : 0)}`
                  : `${fmtQty(availableShares)} free`}
              </span>
            </span>
            <span className="relative">
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={fieldClass}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ash pointer-events-none">shares</span>
            </span>
          </label>

          <div className="grid grid-cols-4 gap-1">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handlePercentPick(pct)}
                className="h-7 rounded-[3px] border border-rule text-[12px] text-ash hover:text-paper hover:border-zinc-600 cursor-pointer"
              >
                {pct === 100 ? "Max" : `${pct}%`}
              </button>
            ))}
          </div>

          <dl className="flex flex-col gap-1 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-ash">{orderType === "MARKET" ? "Estimated total" : "Total"}</dt>
              <dd className="text-zinc-50 font-medium">{fmtPrice(totalCost)} gold</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ash">{side === "BUY" ? "Purse" : "Your shares"}</dt>
              <dd className="text-paper">{side === "BUY" ? `${fmtGold(userCash)} gold` : `${fmtQty(userHolding?.shares || 0)}`}</dd>
            </div>
          </dl>
        </>
      )}

      {blocked && (
        <p className="text-[12px] text-paper border-l-2 border-bullion pl-2">
          {notTrading
            ? company.status === "HALTED"
              ? "Trading in this company is halted by the operator."
              : "This company is flagged as defaulted. Trading is suspended."
            : `The floor is closed. ${marketSchedule?.statusText || ""}`}
        </p>
      )}

      {feedback && (
        <p role={feedback.type === "error" ? "alert" : "status"} className={`text-[12px] leading-relaxed ${feedback.type === "error" ? "text-bear" : "text-paper"}`}>
          {feedback.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading || !!blocked}
        className={`h-10 rounded-[4px] text-[14px] font-semibold transition-colors disabled:cursor-not-allowed cursor-pointer ${
          blocked
            ? "bg-pane text-ash"
            : side === "BUY"
            ? "bg-bull hover:bg-emerald-400 text-floor"
            : "bg-bear hover:bg-rose-400 text-white"
        } ${isLoading ? "opacity-60" : ""}`}
      >
        {isLoading
          ? "Placing order…"
          : mode === "BASIC"
          ? `⚡ ${side === "BUY" ? "Quick Buy" : "Quick Sell"} ${numQty > 0 ? fmtQty(numQty) + " " : ""}${company.ticker}`
          : `${side === "BUY" ? "Buy" : "Sell"} ${numQty > 0 ? fmtQty(numQty) + " " : ""}${company.ticker}`}
      </button>
    </form>
  );
}
