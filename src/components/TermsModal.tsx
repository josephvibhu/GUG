"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldAlert, Scale, Check, LogOut, ExternalLink, Loader2 } from "lucide-react";
import { refreshMarketFeed } from "@/hooks/useMarketFeed";
import { useRouter } from "next/navigation";

interface TermsModalProps {
  isOpen: boolean;
}

export default function TermsModal({ isOpen }: TermsModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAccept = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept_terms" }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshMarketFeed();
        router.refresh();
      } else {
        setError(data.message || "Failed to record acceptance. Please try again.");
      }
    } catch (err: any) {
      setError(err?.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } finally {
      await refreshMarketFeed();
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl flex flex-col gap-5 text-left text-xs">
        {/* Header Icon */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Terms & Conditions Agreement
            </h2>
            <p className="text-[12px] text-zinc-400">
              Please review and accept before continuing on the exchange
            </p>
          </div>
        </div>

        {/* PROMINENT DISCLAIMER BOX */}
        <div className="bg-amber-500/10 border-2 border-amber-500/35 rounded-xl p-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs uppercase tracking-wide">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            Essential Community Notice
          </div>
          <p className="text-sm font-bold text-white leading-snug">
            Played with Parlamentum gold only. No real money goes in or comes out. Not run by the Parlamentum team.
          </p>
        </div>

        {/* Terms summary bullets */}
        <div className="space-y-2 text-zinc-300 leading-relaxed text-[12px]">
          <p className="text-zinc-400">
            By transacting on Grow Ur Gold, you acknowledge and agree:
          </p>
          <ul className="space-y-1.5 pl-4 list-disc text-zinc-300">
            <li>
              <strong>Virtual currency only:</strong> All assets, company shares, orders, and purses are denominated strictly in Parlamentum virtual gold.
            </li>
            <li>
              <strong>No cash-out:</strong> Exchange gold cannot be redeemed for real-world currency or fiat payments.
            </li>
            <li>
              <strong>Player-operated:</strong> Grow Ur Gold is an independent community project created by players and is not affiliated with Parlamentum game staff.
            </li>
            <li>
              <strong>Fair trading:</strong> Accounts engaging in deceit, fraudulent ledger reporting, or market sabotage may be halted.
            </li>
          </ul>
        </div>

        {/* Read full terms link */}
        <div className="pt-1">
          <Link
            href="/terms"
            target="_blank"
            className="text-amber-400 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1 font-medium"
          >
            Read the complete Terms & Conditions document <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-600/50 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={loading}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs tracking-wide transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Recording acceptance…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                I Agree & Accept Terms
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loading}
            className="w-full sm:w-auto py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
