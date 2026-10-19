"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Company } from "@/lib/market";
import { fmtGold, fmtPrice } from "@/lib/format";

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} className="w-full sm:max-w-md bg-pane border border-rule rounded-t-[6px] sm:rounded-[6px] shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
        <div className="h-12 px-4 flex items-center justify-between border-b border-rule">
          <h2 className="text-[15px] font-semibold text-zinc-50">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="h-8 w-8 -mr-2 rounded-[4px] flex items-center justify-center text-ash hover:text-paper hover:bg-rule">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

const inputClass = "w-full h-10 rounded-[4px] border border-rule bg-floor pl-3 pr-14 text-right text-[15px] text-zinc-50 focus:outline-none focus:border-zinc-500";

export function BuybackDialog({ company, userCash, onClose, onDone }: { company: Company; userCash: number; onClose: () => void; onDone: () => void }) {
  const [gold, setGold] = useState("500");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const amount = parseFloat(gold) || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    if (amount < 10) {
      setResult({ ok: false, message: "The smallest buyback is 10 gold." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/buyback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: company.ticker, goldToSpend: amount }),
      });
      const data = await res.json();
      setResult({ ok: !!data.success, message: data.message || (data.success ? "Done." : "The buyback failed.") });
      if (data.success) onDone();
    } catch {
      setResult({ ok: false, message: "Couldn't reach the exchange. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={`Buy back ${company.ticker} shares`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4 text-[13px]">
        <p className="text-ash leading-relaxed">
          Buys the cheapest shares other holders are offering, up to the gold you set, and retires them. Your own sell orders are skipped.
        </p>
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-[12px] text-ash">
            Gold to spend
            <button type="button" className="hover:text-paper" onClick={() => setGold(String(Math.floor(userCash)))}>
              Purse {fmtGold(userCash)}
            </button>
          </span>
          <span className="relative">
            <input type="number" inputMode="decimal" min="10" value={gold} onChange={(e) => setGold(e.target.value)} className={inputClass} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ash pointer-events-none">gold</span>
          </span>
        </label>
        {result && <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-paper" : "text-bear"}>{result.message}</p>}
        <button type="submit" disabled={busy || userCash < 10} className="h-10 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-semibold disabled:opacity-50">
          {busy ? "Buying back…" : `Buy back up to ${fmtGold(amount)} gold`}
        </button>
      </form>
    </Dialog>
  );
}

export function EarningsDialog({
  company,
  userCash,
  nextFriday,
  founderShares,
  onClose,
  onDone,
}: {
  company: Company;
  userCash: number;
  nextFriday: string;
  founderShares: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [profit, setProfit] = useState("1000");
  const [note, setNote] = useState("");
  const [payNow, setPayNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const profitNum = parseFloat(profit) || 0;
  const pool = Math.round(profitNum * 0.5 * 100) / 100;
  const perShare = company.totalShares > 0 ? pool / company.totalShares : 0;
  const backToFounder = perShare * founderShares;
  const fridayLabel = nextFriday ? new Date(nextFriday).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }) : "Friday";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    if (profitNum <= 0) {
      setResult({ ok: false, message: "Enter the week's net profit in gold." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/dividends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report_earnings",
          companyId: company.id,
          netProfit: profitNum,
          notes: note.trim() || undefined,
          distributeImmediately: payNow,
          scheduledFor: nextFriday,
        }),
      });
      const data = await res.json();
      setResult({ ok: !!data.success, message: data.message || (data.success ? "Filed." : "Filing failed.") });
      if (data.success) onDone();
    } catch {
      setResult({ ok: false, message: "Couldn't reach the exchange. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Report weekly earnings" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4 text-[13px]">
        <p className="text-ash leading-relaxed">
          Half of the net profit goes to shareholders, paid from your purse on {fridayLabel} at 00:00 UTC. Keep that much gold in your purse until then.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-ash">Net profit this week</span>
          <span className="relative">
            <input type="number" inputMode="decimal" min="1" value={profit} onChange={(e) => setProfit(e.target.value)} className={inputClass} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ash pointer-events-none">gold</span>
          </span>
        </label>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] border-y border-rule py-3">
          <dt className="text-ash">Dividend (50%)</dt>
          <dd className="text-right text-bullion font-semibold">{fmtPrice(pool)} gold</dd>
          <dt className="text-ash">Per share</dt>
          <dd className="text-right text-paper">{perShare.toFixed(4)} gold</dd>
          <dt className="text-ash">Back to you as a holder</dt>
          <dd className="text-right text-paper">≈ {fmtPrice(backToFounder)} gold</dd>
          <dt className="text-ash">Your purse</dt>
          <dd className={`text-right ${userCash < pool ? "text-bear" : "text-paper"}`}>{fmtGold(userCash)} gold</dd>
        </dl>
        {userCash < pool && <p className="text-[12px] text-bear">Your purse can&apos;t cover this dividend yet. Deposit gold before the payout.</p>}
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-ash">Note to shareholders (optional)</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} className="h-9 rounded-[4px] border border-rule bg-floor px-3 text-[13px] text-paper focus:outline-none focus:border-zinc-500" />
        </label>
        <label className="flex items-center gap-2 text-paper">
          <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} className="accent-[var(--color-bullion)] h-4 w-4" />
          Pay now instead of on Friday
        </label>
        {result && <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-paper" : "text-bear"}>{result.message}</p>}
        <button type="submit" disabled={busy} className="h-10 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-semibold disabled:opacity-50">
          {busy ? "Filing…" : payNow ? `File and pay ${fmtPrice(pool)} gold now` : "File for Friday"}
        </button>
      </form>
    </Dialog>
  );
}
