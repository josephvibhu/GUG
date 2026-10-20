"use client";

import { useEffect, useState } from "react";
import { X, Check, Copy } from "lucide-react";
import { PortfolioPosition } from "@/lib/market";
import { fmtQty } from "@/lib/format";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  positions: PortfolioPosition[];
  initialCompanyId?: string;
  onGiftCreated: () => void;
}

const field = "h-10 w-full px-3 rounded-[4px] bg-floor border border-rule text-zinc-50 text-[13px] focus:outline-none focus:border-zinc-500";

export default function StockGiftModal({ isOpen, onClose, positions, initialCompanyId, onGiftCreated }: Props) {
  const eligiblePositions = positions.filter((p) => p.availableShares > 0);
  const [companyId, setCompanyId] = useState(initialCompanyId || eligiblePositions[0]?.companyId || "");
  const [shares, setShares] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdGift, setCreatedGift] = useState<{ code: string; ticker: string; companyName: string; shares: number; note?: string } | null>(null);
  const [copied, setCopied] = useState<"code" | "discord" | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!isOpen) return null;

  const selectedPos = eligiblePositions.find((p) => p.companyId === companyId);
  const maxShares = selectedPos ? selectedPos.availableShares : 0;
  const count = parseInt(shares, 10);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isNaN(count) || count <= 0) {
      setError("Enter how many shares to gift.");
      return;
    }
    if (count > maxShares) {
      setError(`You have ${maxShares.toLocaleString()} free shares to gift.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", companyId, shares: count, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "The gift code wasn't created.");
        return;
      }
      setCreatedGift({ code: data.gift.code, ticker: data.gift.ticker, companyName: data.gift.companyName, shares: data.gift.shares, note: data.gift.note });
      onGiftCreated();
    } catch {
      setError("Couldn't reach the exchange. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async (what: "code" | "discord") => {
    if (!createdGift) return;
    const text =
      what === "code"
        ? createdGift.code
        : `🎁 You've been gifted **${createdGift.shares.toLocaleString()} shares of $${createdGift.ticker}** (${createdGift.companyName}) on Grow Ur Gold!\n` +
          (createdGift.note ? `💬 *"${createdGift.note}"*\n` : "") +
          `🎟️ Code: \`${createdGift.code}\`\n👉 Claim it on your portfolio page: ${window.location.origin}/portfolio`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      setError("Copying isn't allowed here. Select the code and copy it by hand.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Gift shares" className="w-full sm:max-w-md bg-pane border border-rule rounded-t-[6px] sm:rounded-[6px] shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
        <div className="h-12 px-4 flex items-center justify-between border-b border-rule">
          <h2 className="text-[15px] font-semibold text-zinc-50">{createdGift ? "Gift code ready" : "Gift shares"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="h-8 w-8 -mr-2 rounded-[4px] flex items-center justify-center text-ash hover:text-paper hover:bg-rule">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4 text-[13px]">
          {createdGift ? (
            <>
              <p className="text-ash leading-relaxed">
                {createdGift.shares.toLocaleString()} {createdGift.ticker} shares are set aside. Whoever enters this code first gets them; until then you can take
                them back from your portfolio.
              </p>
              <div className="rounded-[4px] border border-rule bg-floor px-4 py-3 text-center">
                <span className="condensed tabular text-[24px] font-bold text-zinc-50 tracking-wide select-all">{createdGift.code}</span>
              </div>
              {error && <p role="alert" className="text-bear">{error}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => copy("code")} className="h-10 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-semibold flex items-center justify-center gap-1.5">
                  {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied === "code" ? "Copied" : "Copy code"}
                </button>
                <button type="button" onClick={() => copy("discord")} className="h-10 rounded-[4px] border border-rule hover:border-zinc-500 text-paper flex items-center justify-center gap-1.5">
                  {copied === "discord" ? <Check className="h-4 w-4 text-bull" /> : <Copy className="h-4 w-4 text-ash" />}
                  {copied === "discord" ? "Copied" : "Copy for Discord"}
                </button>
              </div>
              <button type="button" onClick={onClose} className="h-10 rounded-[4px] border border-rule hover:border-zinc-500 text-paper">
                Done
              </button>
            </>
          ) : eligiblePositions.length === 0 ? (
            <p className="text-ash leading-relaxed py-2">
              You have no free shares to gift. Shares in open sell orders can&apos;t be gifted: cancel the order first.
            </p>
          ) : (
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] text-ash">Company</span>
                <select
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    setShares("");
                  }}
                  className={field}
                >
                  {eligiblePositions.map((pos) => (
                    <option key={pos.companyId} value={pos.companyId}>
                      {pos.ticker}, {fmtQty(pos.availableShares)} free shares
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex justify-between text-[12px] text-ash">
                  Shares
                  <button type="button" onClick={() => setShares(String(maxShares))} className="hover:text-paper">
                    Max {fmtQty(maxShares)}
                  </button>
                </span>
                <input type="number" inputMode="numeric" min="1" max={maxShares} step="1" placeholder="0" value={shares} onChange={(e) => setShares(e.target.value)} className={`${field} text-right text-[15px] tabular`} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] text-ash">Note (optional)</span>
                <input type="text" maxLength={140} placeholder="e.g. for winning the duel" value={note} onChange={(e) => setNote(e.target.value)} className={field} />
              </label>
              {error && <p role="alert" className="text-bear">{error}</p>}
              <button
                type="submit"
                disabled={submitting || !(count > 0)}
                className="h-10 rounded-[4px] bg-bullion hover:bg-amber-300 disabled:opacity-50 text-floor font-semibold"
              >
                {submitting ? "Making the code…" : count > 0 ? `Make a code for ${count.toLocaleString()} ${selectedPos?.ticker || ""} shares` : "Make a gift code"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
