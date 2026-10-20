"use client";

import { useState } from "react";
import Link from "next/link";
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
        setError(data.message || "Your answer wasn't saved. Try again.");
      }
    } catch {
      setError("Couldn't reach the exchange. Try again.");
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
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="terms-title" className="w-full sm:max-w-md bg-pane border border-rule rounded-t-[6px] sm:rounded-[6px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] p-5 flex flex-col gap-4 text-[13px]">
        <h2 id="terms-title" className="text-[17px] font-semibold text-zinc-50">Before you trade: the terms</h2>
        <ul className="flex flex-col gap-2 pl-5 list-disc marker:text-ash text-paper leading-relaxed">
          <li>Grow Ur Gold is played with Parlamentum gold only. No real money goes in or comes out.</li>
          <li>It is a player project, not run by the Parlamentum team.</li>
          <li>Deposits and withdrawals happen in the game, as Raw Iron trades with the House.</li>
          <li>Manipulating prices or listing in bad faith can get trading halted or your account frozen.</li>
        </ul>
        <Link href="/terms" target="_blank" className="self-start text-paper underline underline-offset-4">
          Read the full terms
        </Link>
        {error && <p role="alert" className="text-bear">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={handleLogout} className="h-10 rounded-[4px] border border-rule hover:border-zinc-500 text-paper">
            Log out
          </button>
          <button type="button" onClick={handleAccept} disabled={loading} className="h-10 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-semibold disabled:opacity-50">
            {loading ? "Saving…" : "I agree"}
          </button>
        </div>
      </div>
    </div>
  );
}
