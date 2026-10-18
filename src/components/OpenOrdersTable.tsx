"use client";

import { useState } from "react";
import { XCircle } from "lucide-react";

interface OpenOrder {
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
}

export default function OpenOrdersTable({ orders = [], onOrderCancelled }: OpenOrdersTableProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (data.success) {
        onOrderCancelled();
      } else {
        alert(data.message || "Failed to cancel order");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col font-sans text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <h4 className="font-bold text-white text-sm">Your Open Exchange Orders</h4>
        <span className="text-zinc-400 font-mono text-[11px]">{orders.length} active orders</span>
      </div>

      {orders.length === 0 ? (
        <div className="py-8 text-center text-zinc-400">
          You have no open limit orders in the order book.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono mt-2">
            <thead>
              <tr className="text-[10px] text-zinc-400 uppercase font-sans border-b border-zinc-800/60">
                <th className="py-2 px-2">Side</th>
                <th className="py-2 px-2">Ticker</th>
                <th className="py-2 px-2 text-right">Price</th>
                <th className="py-2 px-2 text-right">Filled / Total</th>
                <th className="py-2 px-2 text-center">Status</th>
                <th className="py-2 px-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-[11px]">
              {orders.map((order) => {
                const isBuy = order.type === "BUY";
                const isCancelling = cancellingId === order.id;

                return (
                  <tr key={order.id} className="hover:bg-zinc-800/30">
                    <td className="py-2.5 px-2">
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          isBuy
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {order.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-bold text-white">${order.ticker}</td>
                    <td className="py-2.5 px-2 text-right text-zinc-200">{order.price.toFixed(2)} gold</td>
                    <td className="py-2.5 px-2 text-right text-zinc-300">
                      {order.filledQuantity} / {order.initialQuantity}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="text-[10px] bg-zinc-800 text-amber-300 px-2 py-0.5 rounded">
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <button
                        onClick={() => handleCancel(order.id)}
                        disabled={isCancelling}
                        className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded transition cursor-pointer"
                      >
                        <XCircle className="w-3 h-3" />
                        {isCancelling ? "Cancelling..." : "Cancel"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
