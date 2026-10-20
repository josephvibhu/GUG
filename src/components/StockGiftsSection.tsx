"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Copy } from "lucide-react";
import { fmtQty, fmtUtcDate } from "@/lib/format";
import type { StockGift } from "@/lib/giftTypes";

interface Props {
  onPortfolioRefresh: () => void;
  openCreateModal: () => void;
}

const STATUS: Record<string, string> = { ACTIVE: "Not claimed yet", CANCELLED: "Taken back" };

export default function StockGiftsSection({ onPortfolioRefresh, openCreateModal }: Props) {
  const [sentGifts, setSentGifts] = useState<StockGift[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<StockGift[]>([]);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"sent" | "received">("sent");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchGifts = useCallback(async () => {
    try {
      const res = await fetch("/api/gifts", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setSentGifts(data.sent || []);
        setReceivedGifts(data.received || []);
      }
    } catch {
      // the list stays as it was; the next action retries
    }
  }, []);

  useEffect(() => {
    fetchGifts();
  }, [fetchGifts]);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setNote(null);
    const code = redeemCode.trim().toUpperCase();
    if (!code) return;
    setRedeeming(true);
    try {
      const res = await fetch("/api/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "redeem", code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setNote({ ok: false, text: data.message || "That code didn't work." });
        return;
      }
      setNote({ ok: true, text: data.message });
      setRedeemCode("");
      await fetchGifts();
      onPortfolioRefresh();
    } catch {
      setNote({ ok: false, text: "Couldn't reach the exchange. Try again." });
    } finally {
      setRedeeming(false);
    }
  };

  const handleCancelGift = async (gift: StockGift) => {
    if (!confirm(`Take back gift ${gift.code}? The ${gift.shares} ${gift.ticker} shares return to your portfolio.`)) return;
    try {
      const res = await fetch("/api/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", giftId: gift.id }),
      });
      const data = await res.json();
      setNote({ ok: !!data.success, text: data.message || (data.success ? "Shares returned." : "Couldn't take the gift back.") });
      await fetchGifts();
      onPortfolioRefresh();
    } catch {
      setNote({ ok: false, text: "Couldn't reach the exchange. Try again." });
    }
  };

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      setNote({ ok: false, text: "Copying isn't allowed here. Select the code and copy it by hand." });
    }
  };

  const discordText = (gift: StockGift) =>
    `🎁 You've been gifted **${gift.shares.toLocaleString()} shares of $${gift.ticker}** (${gift.companyName}) on Grow Ur Gold!\n` +
    (gift.note ? `💬 *"${gift.note}"*\n` : "") +
    `🎟️ Code: \`${gift.code}\`\n👉 Claim it on your portfolio page: ${window.location.origin}/portfolio`;

  const list = activeTab === "sent" ? sentGifts : receivedGifts;

  return (
    <section aria-labelledby="stock-gifts" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="stock-gifts" className="text-[15px] font-semibold text-zinc-50">Gift shares</h2>
        <button type="button" onClick={openCreateModal} className="h-8 px-3 rounded-[4px] border border-rule hover:border-zinc-500 text-[13px] text-paper">
          New gift code
        </button>
      </div>
      <p className="text-[12px] text-ash -mt-1">Turn some of your shares into a code anyone can claim, or claim a code you were sent.</p>

      <form onSubmit={handleRedeem} className="flex gap-2">
        <label className="flex-1 min-w-0">
          <span className="sr-only">Gift code</span>
          <input
            type="text"
            placeholder="Gift code"
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value)}
            autoCapitalize="characters"
            spellCheck={false}
            className="h-9 w-full px-3 rounded-[4px] bg-floor border border-rule text-zinc-50 text-[13px] uppercase placeholder:normal-case placeholder:text-ash focus:outline-none focus:border-zinc-500"
          />
        </label>
        <button
          type="submit"
          disabled={redeeming || !redeemCode.trim()}
          className="h-9 px-4 rounded-[4px] bg-bullion hover:bg-amber-300 disabled:opacity-50 text-floor text-[13px] font-semibold shrink-0"
        >
          {redeeming ? "Claiming…" : "Claim"}
        </button>
      </form>
      {note && (
        <p role={note.ok ? "status" : "alert"} className={`text-[13px] ${note.ok ? "text-paper" : "text-bear"}`}>
          {note.text}
        </p>
      )}

      <div className="border border-rule rounded-[4px]">
        <div role="tablist" aria-label="Gifts" className="h-10 flex items-stretch gap-1 px-2 border-b border-rule text-[13px]">
          {([
            ["sent", `Sent ${sentGifts.length}`],
            ["received", `Claimed ${receivedGifts.length}`],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`px-2.5 border-b-2 -mb-px ${activeTab === id ? "text-zinc-50 border-zinc-50" : "text-ash border-transparent hover:text-paper"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <p className="px-4 py-5 text-[13px] text-ash">
            {activeTab === "sent" ? "You haven't made a gift code yet." : "You haven't claimed a gift yet."}
          </p>
        ) : (
          <ul className="divide-y divide-rule">
            {list.map((gift) => (
              <li key={gift.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
                <div className="min-w-0 flex-1">
                  <div className="text-paper">
                    <span className="tabular text-zinc-50">{fmtQty(gift.shares)}</span>{" "}
                    <span className="condensed font-bold text-zinc-50">{gift.ticker}</span> shares
                    {activeTab === "received" && <span className="text-ash"> from {gift.senderName}</span>}
                  </div>
                  <div className="text-[12px] text-ash">
                    <span className="select-all text-paper">{gift.code}</span>{" "}
                    {activeTab === "sent"
                      ? gift.status === "REDEEMED"
                        ? `claimed by ${gift.recipientName || "a citizen"}`
                        : STATUS[gift.status]?.toLowerCase() || gift.status
                      : `claimed ${fmtUtcDate(gift.redeemedAt || gift.createdAt)}`}
                  </div>
                </div>
                {activeTab === "sent" && gift.status === "ACTIVE" && (
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => copy(gift.code, gift.id)} className="h-8 px-2.5 rounded-[4px] border border-rule hover:border-zinc-500 text-[12px] text-paper flex items-center gap-1">
                      {copiedId === gift.id ? <Check className="h-3.5 w-3.5 text-bull" /> : <Copy className="h-3.5 w-3.5 text-ash" />}
                      Code
                    </button>
                    <button type="button" onClick={() => copy(discordText(gift), `d_${gift.id}`)} className="h-8 px-2.5 rounded-[4px] border border-rule hover:border-zinc-500 text-[12px] text-paper flex items-center gap-1">
                      {copiedId === `d_${gift.id}` ? <Check className="h-3.5 w-3.5 text-bull" /> : <Copy className="h-3.5 w-3.5 text-ash" />}
                      Discord
                    </button>
                    <button type="button" onClick={() => handleCancelGift(gift)} className="h-8 px-2.5 rounded-[4px] border border-rule hover:border-bear/60 text-[12px] text-bear">
                      Take back
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
