"use client";

import { useState, useEffect, useCallback } from "react";
import { Gift, Check, Copy, Undo2, Sparkles, AlertCircle, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { fmtQty, fmtUtcDate } from "@/lib/format";
import type { StockGift } from "@/lib/giftTypes";

interface Props {
  onPortfolioRefresh: () => void;
  openCreateModal: () => void;
}

export default function StockGiftsSection({ onPortfolioRefresh, openCreateModal }: Props) {
  const [loading, setLoading] = useState(true);
  const [sentGifts, setSentGifts] = useState<StockGift[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<StockGift[]>([]);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"sent" | "received">("sent");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchGifts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/gifts", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setSentGifts(data.sent || []);
        setReceivedGifts(data.received || []);
      }
    } catch (err) {
      console.error("Error loading gifts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGifts();
  }, [fetchGifts]);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setRedeemMsg(null);

    const clean = redeemCode.trim().toUpperCase();
    if (!clean) {
      setRedeemMsg({ type: "error", text: "Please enter a valid gift coupon code." });
      return;
    }

    try {
      setRedeeming(true);
      const res = await fetch("/api/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "redeem", code: clean }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setRedeemMsg({ type: "error", text: data.message || "Failed to redeem gift coupon." });
        return;
      }

      setRedeemMsg({ type: "success", text: data.message });
      setRedeemCode("");
      await fetchGifts();
      onPortfolioRefresh();
      setTimeout(() => setRedeemMsg(null), 6000);
    } catch (err: any) {
      setRedeemMsg({ type: "error", text: err.message || "Network error claiming gift." });
    } finally {
      setRedeeming(false);
    }
  };

  const handleCancelGift = async (giftId: string, code: string) => {
    if (!confirm(`Cancel gift voucher ${code}? The shares will be immediately returned to your portfolio.`)) return;

    try {
      const res = await fetch("/api/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", giftId }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "Failed to cancel voucher.");
        return;
      }

      await fetchGifts();
      onPortfolioRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to cancel voucher.");
    }
  };

  const copyVoucherCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const copyDiscordShare = (gift: StockGift) => {
    const text = `🎁 **Grow Ur Gold Stock Gift Coupon**
Hey! You have been gifted **${gift.shares.toLocaleString()} shares of $${gift.ticker}** (${gift.companyName})!
${gift.note ? `💬 *"${gift.note}"*\n` : ""}
🎟️ **Coupon Code:** \`${gift.code}\`
👉 Redeem instantly in your portfolio at: https://gug.vercel.app/portfolio`;

    navigator.clipboard.writeText(text);
    setCopiedId(`disc_${gift.id}`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <section aria-labelledby="stock-gifts" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="stock-gifts" className="text-[15px] font-semibold text-zinc-50 flex items-center gap-2">
            <Gift className="w-4 h-4 text-bullion" />
            Stock Gift Coupons
          </h2>
          <p className="text-[12px] text-ash mt-0.5">
            Gift shares of companies you own to fellow citizens, or claim coupon codes you were sent.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="h-8 px-3 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Gift className="w-3.5 h-3.5" />
          Create Gift Coupon
        </button>
      </div>

      {/* Redeem Voucher Card */}
      <div className="p-4 rounded-[4px] bg-pane border border-rule flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-bullion/10 border border-bullion/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-bullion" />
          </div>
          <div>
            <div className="text-[13px] font-medium text-zinc-50">Have a Stock Gift Code?</div>
            <div className="text-[11px] text-ash">Enter the coupon code you received to claim shares immediately.</div>
          </div>
        </div>

        <form onSubmit={handleRedeem} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="e.g. GUG-IRON-A8D9F1"
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
            className="h-9 px-3 rounded-[4px] bg-floor border border-rule text-zinc-50 text-[13px] font-mono uppercase tracking-wider focus:outline-none focus:border-bullion w-full sm:w-[220px]"
          />
          <button
            type="submit"
            disabled={redeeming || !redeemCode.trim()}
            className="h-9 px-4 rounded-[4px] bg-bullion hover:bg-amber-300 disabled:opacity-50 text-floor text-[12px] font-semibold shrink-0 transition-colors cursor-pointer"
          >
            {redeeming ? "Claiming…" : "Claim Gift"}
          </button>
        </form>
      </div>

      {redeemMsg && (
        <div
          className={`p-3 rounded-[4px] text-[12px] flex items-center gap-2 ${
            redeemMsg.type === "success"
              ? "bg-bull/10 border border-bull/30 text-bull"
              : "bg-bear/10 border border-bear/30 text-bear"
          }`}
        >
          {redeemMsg.type === "success" ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {redeemMsg.text}
        </div>
      )}

      {/* Tabs: Sent vs Received */}
      <div className="flex flex-col border border-rule rounded-[4px] overflow-hidden">
        <div className="h-10 flex items-stretch border-b border-rule bg-pane/40 text-[12px]">
          <button
            type="button"
            onClick={() => setActiveTab("sent")}
            className={`px-4 flex items-center gap-1.5 border-b-2 -mb-px font-medium transition-colors cursor-pointer ${
              activeTab === "sent" ? "text-zinc-50 border-bullion" : "text-ash border-transparent hover:text-paper"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Sent Gift Coupons ({sentGifts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("received")}
            className={`px-4 flex items-center gap-1.5 border-b-2 -mb-px font-medium transition-colors cursor-pointer ${
              activeTab === "received" ? "text-zinc-50 border-bullion" : "text-ash border-transparent hover:text-paper"
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Gifts Claimed ({receivedGifts.length})
          </button>
        </div>

        {/* Tab 1: Sent Gifts */}
        {activeTab === "sent" && (
          <div className="overflow-x-auto">
            {sentGifts.length === 0 ? (
              <div className="p-6 text-center text-ash text-[13px]">
                You haven&apos;t created any stock gift vouchers yet. Click &ldquo;Create Gift Coupon&rdquo; to send shares to friends!
              </div>
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-ash text-left border-b border-rule">
                    <th scope="col" className="font-normal py-2.5 pl-4 pr-2">Code</th>
                    <th scope="col" className="font-normal py-2.5 px-2">Company</th>
                    <th scope="col" className="font-normal py-2.5 px-2 text-right">Shares</th>
                    <th scope="col" className="font-normal py-2.5 px-2">Status</th>
                    <th scope="col" className="font-normal py-2.5 px-2 hidden sm:table-cell">Created</th>
                    <th scope="col" className="font-normal py-2.5 pl-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sentGifts.map((gift) => {
                    const isActive = gift.status === "ACTIVE";
                    const isRedeemed = gift.status === "REDEEMED";
                    return (
                      <tr key={gift.id} className="border-b border-rule last:border-0 hover:bg-pane/30 transition-colors">
                        <td className="py-2.5 pl-4 pr-2 font-mono font-medium text-zinc-50 select-all whitespace-nowrap">
                          {gift.code}
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="font-bold text-paper">${gift.ticker}</span>{" "}
                          <span className="text-ash text-[11px] truncate max-w-[140px] inline-block align-bottom">
                            ({gift.companyName})
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium text-zinc-50">{fmtQty(gift.shares)}</td>
                        <td className="py-2.5 px-2">
                          {isActive && (
                            <span className="inline-block px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold bg-bull/10 border border-bull/30 text-bull">
                              ACTIVE (Unclaimed)
                            </span>
                          )}
                          {isRedeemed && (
                            <span className="inline-block px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold bg-pane border border-rule text-ash">
                              Claimed by {gift.recipientName || "Citizen"}
                            </span>
                          )}
                          {gift.status === "CANCELLED" && (
                            <span className="inline-block px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold bg-bear/10 border border-bear/30 text-bear">
                              CANCELLED
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-ash whitespace-nowrap hidden sm:table-cell">
                          {fmtUtcDate(gift.createdAt)}
                        </td>
                        <td className="py-2.5 pl-2 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isActive && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => copyVoucherCode(gift.code, gift.id)}
                                  className="h-7 px-2 rounded-[3px] bg-pane border border-rule hover:border-zinc-500 text-[11px] text-paper flex items-center gap-1 cursor-pointer"
                                  title="Copy code"
                                >
                                  {copiedId === gift.id ? <Check className="w-3 h-3 text-bull" /> : <Copy className="w-3 h-3 text-ash" />}
                                  {copiedId === gift.id ? "Copied" : "Copy"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyDiscordShare(gift)}
                                  className="h-7 px-2 rounded-[3px] bg-pane border border-rule hover:border-zinc-500 text-[11px] text-paper flex items-center gap-1 cursor-pointer"
                                  title="Copy Discord text"
                                >
                                  {copiedId === `disc_${gift.id}` ? <Check className="w-3 h-3 text-bull" /> : <Gift className="w-3 h-3 text-bullion" />}
                                  Discord
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancelGift(gift.id, gift.code)}
                                  className="h-7 px-2 rounded-[3px] border border-bear/40 hover:bg-bear/10 text-[11px] text-bear flex items-center gap-1 cursor-pointer"
                                  title="Cancel voucher and return shares to your portfolio"
                                >
                                  <Undo2 className="w-3 h-3" />
                                  Reclaim
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Received Gifts */}
        {activeTab === "received" && (
          <div className="overflow-x-auto">
            {receivedGifts.length === 0 ? (
              <div className="p-6 text-center text-ash text-[13px]">
                You haven&apos;t claimed any stock gift coupons yet.
              </div>
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-ash text-left border-b border-rule">
                    <th scope="col" className="font-normal py-2.5 pl-4 pr-2">Claimed</th>
                    <th scope="col" className="font-normal py-2.5 px-2">Company</th>
                    <th scope="col" className="font-normal py-2.5 px-2 text-right">Shares</th>
                    <th scope="col" className="font-normal py-2.5 px-2">From</th>
                    <th scope="col" className="font-normal py-2.5 pl-2 pr-4 text-right">Code</th>
                  </tr>
                </thead>
                <tbody>
                  {receivedGifts.map((gift) => (
                    <tr key={gift.id} className="border-b border-rule last:border-0 hover:bg-pane/30 transition-colors">
                      <td className="py-2.5 pl-4 pr-2 text-ash whitespace-nowrap">
                        {fmtUtcDate(gift.redeemedAt || gift.createdAt)}
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="font-bold text-paper">${gift.ticker}</span>{" "}
                        <span className="text-ash text-[11px] truncate max-w-[140px] inline-block align-bottom">
                          ({gift.companyName})
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-medium text-bullion">+{fmtQty(gift.shares)}</td>
                      <td className="py-2.5 px-2 text-paper">{gift.senderName}</td>
                      <td className="py-2.5 pl-2 pr-4 text-right font-mono text-ash select-all">
                        {gift.code}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
