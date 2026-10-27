"use client";

import { useState } from "react";
import Link from "next/link";
import { Company, PortfolioPosition, OrderBookData } from "@/lib/market";
import { fmtPrice, fmtQty, fmtGold } from "@/lib/format";

interface TradeFormProps {
  company: Company;
  userHolding: PortfolioPosition | null;
  userCash: number;
  loggedIn: boolean;
  selectedPrice: number | null;
  orderBook?: OrderBookData;
  marketSchedule?: { isOpen: boolean; statusText: string } | null;
  onTradeSuccess: () => void;
}

export default function TradeForm({
  company,
  userHolding,
  userCash,
  loggedIn,
  selectedPrice,
  orderBook,
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

  // Lowest Ask on the order book (cheapest seller) and Highest Bid (best buyer)
  const lowestAsk = orderBook?.asks && orderBook.asks.length > 0 ? orderBook.asks[0].price : null;
  const highestBid = orderBook?.bids && orderBook.bids.length > 0 ? orderBook.bids[0].price : null;

  // In Basic Mode:
  // Buying executes at the lowest available ask from sellers.
  // Selling executes at the highest available bid from buyers.
  const marketExecutionPrice = side === "BUY"
    ? (lowestAsk ?? company.currentPrice)
    : (highestBid ?? company.currentPrice);

  // A click on an order-book level fills in that price and switches to Advanced mode
  const [seenPrice, setSeenPrice] = useState(selectedPrice);
  if (selectedPrice !== seenPrice) {
    setSeenPrice(selectedPrice);
    if (selectedPrice) {
      setOrderType("LIMIT");
      setMode("ADVANCED");
      setPrice(selectedPrice.toFixed(2));
    }
  }

  const numPrice = orderType === "LIMIT" ? parseFloat(price) || 0 : marketExecutionPrice;
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
      <div className="grid grid-cols-2 gap-0.5 p-0.5 rounded-[4px] border border-rule" role="group" aria-label="Ticket">
        {(["BASIC", "ADVANCED"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              if (m === "BASIC") setOrderType("MARKET");
              setFeedback(null);
            }}
            className={`h-7 rounded-[3px] text-[12px] ${mode === m ? "bg-rule text-zinc-50 font-semibold" : "text-ash hover:text-paper"}`}
          >
            {m === "BASIC" ? "Basic" : "Advanced"}
          </button>
        ))}
      </div>

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
            className={`h-8 rounded-[3px] font-semibold transition-colors ${
              side === s ? (s === "BUY" ? "bg-bull text-floor" : "bg-bear text-white") : "text-ash hover:text-paper"
            }`}
          >
            {s === "BUY" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      {mode === "BASIC" ? (
        <div className="flex flex-col gap-3">
          {(side === "BUY" ? lowestAsk : highestBid) != null ? (
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-ash">{side === "BUY" ? "Cheapest share for sale" : "Best offer from a buyer"}</span>
              <span className="text-right">
                <span className="condensed tabular text-[18px] font-bold text-zinc-50">{fmtPrice((side === "BUY" ? lowestAsk : highestBid) as number)}</span>
                <span className="block text-[11px] text-ash tabular">last trade {fmtPrice(company.currentPrice)}</span>
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-2 text-[12px] text-ash">
              <p>{side === "BUY" ? "Nobody is selling right now." : "Nobody is buying right now."} Name your price with a limit order instead.</p>
              <button
                type="button"
                onClick={() => {
                  setMode("ADVANCED");
                  setOrderType("LIMIT");
                  setPrice((side === "SELL" && lowestAsk ? lowestAsk : company.currentPrice).toFixed(2));
                }}
                className="h-8 px-3 rounded-[4px] border border-rule hover:border-zinc-500 text-[12px] text-paper"
              >
                Place a limit order
              </button>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="flex justify-between text-[12px] text-ash">
              Shares
              <span className="tabular">
                {side === "BUY" ? `up to ${fmtQty(numPrice > 0 ? Math.floor(userCash / escrowPrice) : 0)}` : `${fmtQty(availableShares)} free`}
              </span>
            </span>
            <div className="flex items-center rounded-[4px] border border-rule bg-floor">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, (parseInt(quantity, 10) || 1) - 1).toString())}
                className="h-9 w-10 text-[18px] text-paper hover:text-zinc-50"
                aria-label="One share fewer"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                aria-label="Shares"
                className="flex-1 min-w-0 h-9 bg-transparent text-center text-[15px] text-zinc-50 tabular focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQuantity(((parseInt(quantity, 10) || 0) + 1).toString())}
                className="h-9 w-10 text-[18px] text-paper hover:text-zinc-50"
                aria-label="One share more"
              >
                +
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {[1, 5, 10, 25].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQuantity(preset.toString())}
                  className={`h-7 rounded-[3px] border text-[12px] tabular ${
                    quantity === preset.toString() ? "border-zinc-500 text-zinc-50" : "border-rule text-ash hover:text-paper"
                  }`}
                >
                  {preset}
                </button>
              ))}
              {[25, 50, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handlePercentPick(pct)}
                  className="h-7 rounded-[3px] border border-rule text-[12px] text-ash hover:text-paper"
                >
                  {pct === 100 ? (side === "BUY" ? "Max" : "All") : `${pct}%`}
                </button>
              ))}
            </div>
          </div>

          <dl className="flex flex-col gap-1 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-ash">{side === "BUY" ? "Estimated cost" : "Estimated payout"}</dt>
              <dd className="text-zinc-50 font-medium tabular">{fmtPrice(totalCost)} gold</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ash">{side === "BUY" ? "Purse" : "Your shares"}</dt>
              <dd className="text-paper tabular">{side === "BUY" ? `${fmtGold(userCash)} gold` : fmtQty(availableShares)}</dd>
            </div>
          </dl>
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
        <div className="p-2.5 rounded-[4px] bg-rose-950/40 border border-rose-500/40 text-[12px] text-zinc-200 flex flex-col gap-1">
          <div className="font-bold text-rose-400 flex items-center gap-1.5">
            <span>⚔️</span>
            <span>{notTrading ? "Trading Suspended" : "Exchange Floor Closed (World War)"}</span>
          </div>
          <p className="text-[11px] text-ash">
            {notTrading
              ? company.status === "HALTED"
                ? "Trading in this company is halted by the operator."
                : "This company is flagged as defaulted. Trading is suspended."
              : (marketSchedule?.statusText || "All trading operations are suspended due to the World War.")}
          </p>
        </div>
      )}

      {feedback && (
        <p role={feedback.type === "error" ? "alert" : "status"} className={`text-[12px] leading-relaxed ${feedback.type === "error" ? "text-bear" : "text-paper"}`}>
          {feedback.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading || !!blocked || (mode === "BASIC" && ((side === "BUY" && lowestAsk == null) || (side === "SELL" && highestBid == null)))}
        className={`h-10 rounded-[4px] text-[14px] font-semibold transition-colors disabled:cursor-not-allowed ${
          blocked || (mode === "BASIC" && ((side === "BUY" && lowestAsk == null) || (side === "SELL" && highestBid == null)))
            ? "bg-pane text-ash border border-rule"
            : side === "BUY"
            ? "bg-bull hover:brightness-110 text-floor"
            : "bg-bear hover:brightness-110 text-white"
        } ${isLoading ? "opacity-60" : ""}`}
      >
        {isLoading
          ? "Placing order…"
          : floorClosed
          ? "Floor Closed (World War)"
          : mode === "BASIC" && ((side === "BUY" && lowestAsk == null) || (side === "SELL" && highestBid == null))
          ? side === "BUY" ? "Nothing for sale" : "No buyers"
          : `${side === "BUY" ? "Buy" : "Sell"} ${numQty > 0 ? fmtQty(numQty) + " " : ""}${company.ticker}${mode === "BASIC" && numQty > 0 ? ` for ${fmtPrice(totalCost)} gold` : ""}`}
      </button>
    </form>
  );
}
