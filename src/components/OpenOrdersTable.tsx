"use client";

import { useState } from "react";
import { fmtPrice, fmtQty, fmtUtcDate, fmtUtcTime } from "@/lib/format";

export interface OpenOrder {
  id: string;
  ticker: string;
  companyName: string;
  type: string;
  orderType: string;
  price: number;
  initialQuantity: number;
  remainingQuantity: number;
  filledQuantity: number;
  status: string;
  createdAt: string;
}

interface OpenOrdersTableProps {
  orders: OpenOrder[];
  onOrderCancelled: () => void;
  showTicker?: boolean;
}

export default function OpenOrdersTable({ orders = [], onOrderCancelled, showTicker = false }: OpenOrdersTableProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async (orderId: string) => {
    setCancellingId(orderId);
    setError(null);
    try {
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (data.success) {
        onOrderCancelled();
        window.dispatchEvent(new Event("wallet_updated"));
      } else {
        setError(data.message || "The order couldn't be cancelled.");
      }
    } catch {
      setError("Couldn't reach the exchange. Try again.");
    } finally {
      setCancellingId(null);
    }
  };

  if (orders.length === 0) {
    return <p className="px-4 py-6 text-[13px] text-ash">No open orders. Limit orders that don&apos;t fill right away wait here.</p>;
  }

  return (
    <div className="overflow-x-auto">
      {error && <p role="alert" className="px-4 pt-3 text-[12px] text-bear">{error}</p>}
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-ash text-left">
            {showTicker && <th scope="col" className="font-normal py-2 pl-4 pr-2">Company</th>}
            <th scope="col" className={`font-normal py-2 pr-2 ${showTicker ? "" : "pl-4"}`}>Side</th>
            <th scope="col" className="font-normal py-2 px-2 text-right">Price</th>
            <th scope="col" className="font-normal py-2 px-2 text-right">Filled</th>
            <th scope="col" className="font-normal py-2 px-2 text-right hidden sm:table-cell">Placed (UTC)</th>
            <th scope="col" className="py-2 pl-2 pr-4"><span className="sr-only">Cancel</span></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const isBuy = order.type === "BUY";
            return (
              <tr key={order.id} className="border-t border-rule">
                {showTicker && <td className="py-2 pl-4 pr-2 condensed font-bold text-[13px] text-zinc-50">{order.ticker}</td>}
                <td className={`py-2 pr-2 font-medium ${showTicker ? "" : "pl-4"} ${isBuy ? "text-bull" : "text-bear"}`}>
                  {isBuy ? "Buy" : "Sell"}
                </td>
                <td className="py-2 px-2 text-right text-zinc-50">{fmtPrice(order.price)}</td>
                <td className="py-2 px-2 text-right text-paper">
                  {fmtQty(order.filledQuantity)} <span className="text-ash">/ {fmtQty(order.initialQuantity)}</span>
                </td>
                <td className="py-2 px-2 text-right text-ash hidden sm:table-cell">
                  {fmtUtcDate(order.createdAt)} {fmtUtcTime(order.createdAt).slice(0, 5)}
                </td>
                <td className="py-2 pl-2 pr-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleCancel(order.id)}
                    disabled={cancellingId === order.id}
                    className="h-7 px-2.5 rounded-[3px] border border-rule text-paper hover:border-zinc-500 disabled:opacity-50"
                  >
                    {cancellingId === order.id ? "Cancelling…" : "Cancel"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
