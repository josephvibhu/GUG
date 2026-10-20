"use client";

import { useState } from "react";
import { Coins, AlertTriangle, CheckCircle2, ArrowRight, Loader2, Sparkles, Scale } from "lucide-react";
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

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl flex flex-col gap-4 text-left text-xs max-h-[92vh] overflow-y-auto">
        {/* Header Icon & Title */}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
            <Coins className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-1">
              <Sparkles className="w-3 h-3" /> Purse Credited Successfully
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Deposit Adjustment & Apology
            </h2>
            <p className="text-[12px] text-zinc-400">
              Parlamentum Raw Iron pricing & 5% in-game tax recalibration
            </p>
          </div>
        </div>

        {/* Apology & Context Box */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-[11px] uppercase tracking-wide">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            Sincere Apology from the Exchange House
          </div>
          <p className="text-zinc-300 leading-relaxed text-[11px]">
            We apologize for the pricing discrepancy on recent in-game Raw Iron deposits. The listings in Parlamentum were offered at <strong>5.50 gold each</strong> (instead of 5.00 gold). When purchasing on the Parlamentum market, the game engine automatically levies a <strong>5% market sales tax</strong> (-0.275 gold/unit).
          </p>
        </div>

        {/* What Changed & What Was Done */}
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3.5 flex flex-col gap-2">
          <div className="text-white font-bold text-[12px] flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            What Was Rectified: Net Gold Credited
          </div>
          <p className="text-zinc-400 text-[11px] leading-relaxed">
            Your purse was initially credited based on the old 5.00 gold baseline. The Exchange Operator has now retroactively recalculated your purchase to <strong>100% of the Net Gold Received by the House (5.225 gold per unit)</strong>, crediting the full difference directly into your balance!
          </p>
        </div>

        {/* Personalized Ledger Breakdown */}
        <div className="bg-zinc-950 rounded-xl border border-zinc-800/90 p-3.5 flex flex-col gap-2 font-mono text-[11px]">
          <div className="text-zinc-400 font-sans font-bold text-[11px] uppercase tracking-wider text-zinc-300 border-b border-zinc-800 pb-1.5 flex justify-between">
            <span>Your Recalibration Breakdown</span>
            <span className="text-amber-400 font-mono">{info.inGameName}</span>
          </div>

          <div className="flex justify-between py-0.5 text-zinc-400">
            <span>Raw Iron Purchased:</span>
            <span className="text-white font-bold">{info.units} units</span>
          </div>

          <div className="flex justify-between py-0.5 text-zinc-400">
            <span>Gold Spent In-Game (@ 5.50g):</span>
            <span className="text-white">{info.grossPaid.toFixed(2)} gold</span>
          </div>

          <div className="flex justify-between py-0.5 text-rose-400/90">
            <span>Parlamentum In-Game 5% Tax:</span>
            <span>-{info.taxDeducted.toFixed(2)} gold</span>
          </div>

          <div className="flex justify-between py-0.5 text-zinc-300 border-t border-zinc-800/80 pt-1">
            <span>Net Gold Received by House (@ 5.225g):</span>
            <span className="font-bold text-amber-300">{info.netReceived.toFixed(2)} gold</span>
          </div>

          <div className="flex justify-between py-0.5 text-zinc-500">
            <span>Initially Credited on GUG:</span>
            <span>{info.initialCredited.toFixed(2)} gold</span>
          </div>

          <div className="flex justify-between py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2 mt-1 text-emerald-300 font-bold">
            <span className="flex items-center gap-1 font-sans">
              <Sparkles className="w-3.5 h-3.5" /> Extra Added to Your Purse:
            </span>
            <span className="text-sm">+{info.adjustmentCredit.toFixed(2)} gold</span>
          </div>
        </div>

        {error && (
          <div className="text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2 text-[11px]">
            {error}
          </div>
        )}

        {/* Action Button */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={handleDismiss}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold text-xs tracking-wide transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Updating Purse...
              </>
            ) : (
              <>
                <span>I Understand & Acknowledge Adjustment</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <p className="text-[10px] text-zinc-500 text-center">
            You can also view this entry anytime in your Wallet Ledger under &apos;Deposit Recalibration&apos;.
          </p>
        </div>
      </div>
    </div>
  );
}
