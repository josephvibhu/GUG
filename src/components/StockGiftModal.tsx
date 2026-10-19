"use client";

import { useState } from "react";
import { X, Gift, Check, Copy, ExternalLink, AlertCircle } from "lucide-react";
import { PortfolioPosition } from "@/lib/market";
import { fmtQty } from "@/lib/format";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  positions: PortfolioPosition[];
  initialCompanyId?: string;
  onGiftCreated: () => void;
}

export default function StockGiftModal({
  isOpen,
  onClose,
  positions,
  initialCompanyId,
  onGiftCreated,
}: Props) {
  const eligiblePositions = positions.filter((p) => p.availableShares > 0);
  const defaultCompId = initialCompanyId || eligiblePositions[0]?.companyId || "";

  const [companyId, setCompanyId] = useState(defaultCompId);
  const [shares, setShares] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success view state
  const [createdGift, setCreatedGift] = useState<{
    code: string;
    ticker: string;
    companyName: string;
    shares: number;
    note?: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedDiscord, setCopiedDiscord] = useState(false);

  if (!isOpen) return null;

  const selectedPos = eligiblePositions.find((p) => p.companyId === companyId);
  const maxShares = selectedPos ? selectedPos.availableShares : 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numShares = parseInt(shares, 10);
    if (isNaN(numShares) || numShares <= 0) {
      setError("Please enter a valid share count (minimum 1 share).");
      return;
    }

    if (numShares > maxShares) {
      setError(`You only have ${maxShares.toLocaleString()} free shares available to gift.`);
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          companyId,
          shares: numShares,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Failed to create gift voucher.");
        return;
      }

      setCreatedGift({
        code: data.gift.code,
        ticker: data.gift.ticker,
        companyName: data.gift.companyName,
        shares: data.gift.shares,
        note: data.gift.note,
      });

      onGiftCreated();
    } catch (err: any) {
      setError(err.message || "Network error creating gift voucher.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = () => {
    if (!createdGift) return;
    navigator.clipboard.writeText(createdGift.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const copyDiscordMessage = () => {
    if (!createdGift) return;
    const msg = `🎁 **Grow Ur Gold Stock Gift Coupon**
Hey! You have been gifted **${createdGift.shares.toLocaleString()} shares of $${createdGift.ticker}** (${createdGift.companyName})!
${createdGift.note ? `💬 *"${createdGift.note}"*\n` : ""}
🎟️ **Coupon Code:** \`${createdGift.code}\`
👉 Redeem instantly in your portfolio at: https://gug.vercel.app/portfolio`;

    navigator.clipboard.writeText(msg);
    setCopiedDiscord(true);
    setTimeout(() => setCopiedDiscord(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-floor border border-rule rounded-[6px] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-rule flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-bullion" />
            <h2 className="text-[15px] font-semibold text-zinc-50">
              {createdGift ? "Stock Gift Coupon Created!" : "Gift Stock Shares"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-ash hover:text-paper rounded-[4px] hover:bg-pane transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4">
          {createdGift ? (
            /* Success State */
            <div className="flex flex-col gap-4 text-center items-center py-2">
              <div className="w-12 h-12 rounded-full bg-bullion/20 border border-bullion/40 flex items-center justify-center text-2xl">
                🎁
              </div>

              <div>
                <h3 className="text-[17px] font-bold text-zinc-50">
                  {createdGift.shares.toLocaleString()} Shares of ${createdGift.ticker}
                </h3>
                <p className="text-[12px] text-ash mt-0.5">
                  The shares have been moved into a secure coupon voucher. Anyone with this code can claim them.
                </p>
              </div>

              {/* Code Box */}
              <div className="w-full p-4 rounded-[4px] bg-pane border border-bullion/50 flex flex-col items-center gap-2">
                <span className="text-[11px] text-ash uppercase tracking-wider font-medium">Coupon Voucher Code</span>
                <span className="text-[20px] font-mono font-bold text-bullion tracking-widest select-all">
                  {createdGift.code}
                </span>
              </div>

              {/* Actions */}
              <div className="w-full grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={copyCode}
                  className="h-9 px-3 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode ? "Copied Code!" : "Copy Code"}
                </button>

                <button
                  type="button"
                  onClick={copyDiscordMessage}
                  className="h-9 px-3 rounded-[4px] border border-rule hover:border-zinc-500 text-paper text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedDiscord ? <Check className="w-3.5 h-3.5 text-bull" /> : <Copy className="w-3.5 h-3.5 text-ash" />}
                  {copiedDiscord ? "Copied Message!" : "Copy Discord Post"}
                </button>
              </div>

              <p className="text-[11px] text-ash/80 mt-1">
                💡 Unclaimed vouchers can be cancelled at any time from your portfolio to return the shares to your account.
              </p>

              <button
                type="button"
                onClick={onClose}
                className="w-full h-9 mt-2 rounded-[4px] border border-rule hover:border-zinc-500 text-[13px] text-paper cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : eligiblePositions.length === 0 ? (
            /* No shares available */
            <div className="py-6 text-center text-ash text-[13px] flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8 text-ash/50" />
              <span>You don&apos;t have any free shares available to gift.</span>
              <span className="text-[11px]">
                Make sure you hold shares and that they aren&apos;t locked in open sell orders.
              </span>
            </div>
          ) : (
            /* Creation Form */
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              {error && (
                <div className="p-2.5 rounded-[4px] bg-bear/10 border border-bear/30 text-bear text-[12px]">
                  {error}
                </div>
              )}

              {/* Company Picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] text-ash font-medium">Select Company Holding</label>
                <select
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    setShares("");
                  }}
                  className="h-10 px-3 rounded-[4px] bg-pane border border-rule text-zinc-50 text-[13px] focus:outline-none focus:border-bullion"
                >
                  {eligiblePositions.map((pos) => (
                    <option key={pos.companyId} value={pos.companyId}>
                      ${pos.ticker} — {pos.name} ({fmtQty(pos.availableShares)} free shares)
                    </option>
                  ))}
                </select>
              </div>

              {/* Shares input */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] text-ash font-medium">Shares to Gift</label>
                  <span className="text-[11px] text-ash">
                    Available: <strong className="text-zinc-50">{fmtQty(maxShares)}</strong>
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max={maxShares}
                    step="1"
                    placeholder="e.g. 25"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    className="w-full h-10 pl-3 pr-16 rounded-[4px] bg-pane border border-rule text-zinc-50 text-[14px] font-mono focus:outline-none focus:border-bullion"
                  />
                  <span className="absolute right-3 top-2.5 text-[12px] text-ash">SHARES</span>
                </div>

                {/* Quick share buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[1, 5, 10, 25, 50, 100].map(
                    (q) =>
                      q <= maxShares && (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setShares(q.toString())}
                          className="px-2 py-0.5 rounded-[3px] bg-pane border border-rule text-[11px] text-ash hover:text-paper hover:border-zinc-500 cursor-pointer"
                        >
                          +{q}
                        </button>
                      )
                  )}
                  <button
                    type="button"
                    onClick={() => setShares(maxShares.toString())}
                    className="px-2 py-0.5 rounded-[3px] bg-pane border border-rule text-[11px] text-bullion hover:border-bullion cursor-pointer"
                  >
                    Max ({fmtQty(maxShares)})
                  </button>
                </div>
              </div>

              {/* Note */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] text-ash font-medium">Gift Note / Message (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. For winning the arena duel! Good luck!"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="h-10 px-3 rounded-[4px] bg-pane border border-rule text-paper text-[13px] focus:outline-none focus:border-bullion"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !shares || parseInt(shares, 10) <= 0}
                className="h-10 mt-2 rounded-[4px] bg-bullion hover:bg-amber-300 disabled:opacity-50 text-floor text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-floor border-t-transparent rounded-full animate-spin" />
                    Generating Coupon Voucher…
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" />
                    Generate Stock Gift Coupon
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
