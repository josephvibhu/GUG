"use client";

import { useState } from "react";
import { refreshMarketFeed, type FeedUser } from "@/hooks/useMarketFeed";
import { useRouter } from "next/navigation";

export interface RecalibratedInfo {
  inGameName: string;
  units: number;
  grossPaid: number;
  taxDeducted: number;
  netReceived: number;
  initialCredited: number;
  adjustmentCredit: number;
}

interface DepositAdjustmentModalProps {
  isOpen: boolean;
  user: FeedUser | null;
}

export default function DepositAdjustmentModal({ isOpen, user }: DepositAdjustmentModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const info = user.adjustment;
  if (!info) return null;

  const handleDismiss = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss_adjustment_notice" }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshMarketFeed();
        router.refresh();
      } else {
        setError(data.message || "Failed to dismiss notice.");
      }
    } catch (err: any) {
      setError(err?.message || "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const row = "flex justify-between gap-3";
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="adj-title" className="w-full sm:max-w-md bg-pane border border-rule rounded-t-[6px] sm:rounded-[6px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] p-5 flex flex-col gap-4 text-[13px]">
        <h2 id="adj-title" className="text-[17px] font-semibold text-zinc-50">Your deposit was re-credited</h2>
        <p className="text-paper leading-relaxed">
          The House&apos;s Raw Iron sold for 5.50 gold, not 5.00, and the game took 5% tax, so the House received 5.225 gold a unit. Your purse was first
          credited at 5.00; it now holds everything the House received. Sorry for the mix-up.
        </p>
        <dl className="flex flex-col gap-1.5 border-y border-rule py-3 tabular">
          <div className={row}><dt className="text-ash">Raw Iron bought ({info.inGameName})</dt><dd className="text-paper">{info.units} units</dd></div>
          <div className={row}><dt className="text-ash">You paid in game</dt><dd className="text-paper">{info.grossPaid.toFixed(2)}</dd></div>
          <div className={row}><dt className="text-ash">Game tax</dt><dd className="text-paper">−{info.taxDeducted.toFixed(2)}</dd></div>
          <div className={row}><dt className="text-ash">The House received</dt><dd className="text-paper">{info.netReceived.toFixed(2)}</dd></div>
          <div className={row}><dt className="text-ash">First credited</dt><dd className="text-paper">{info.initialCredited.toFixed(2)}</dd></div>
          <div className={row}><dt className="text-zinc-50 font-semibold">Added to your purse</dt><dd className="text-bullion font-semibold">+{info.adjustmentCredit.toFixed(2)} gold</dd></div>
        </dl>
        {error && <p role="alert" className="text-bear">{error}</p>}
        <button type="button" onClick={handleDismiss} disabled={loading} className="h-10 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-semibold disabled:opacity-50">
          {loading ? "Saving…" : "Got it"}
        </button>
      </div>
    </div>
  );
}
