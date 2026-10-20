"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Company } from "@/lib/market";
import { fmtGold, fmtPrice } from "@/lib/format";
import { SECTORS } from "@/lib/sectors";

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
  const available = (company.treasuryBalance || 0) + userCash;
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
          Half of the net profit goes to shareholders on {fridayLabel} at 00:00 UTC. It&apos;s paid from the {company.ticker} treasury first, then from your purse if the treasury runs short.
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
          <dt className="text-ash">Treasury + your purse</dt>
          <dd className={`text-right ${available < pool ? "text-bear" : "text-paper"}`}>{fmtGold(available)} gold</dd>
        </dl>
        {available < pool && <p className="text-[12px] text-bear">The treasury and your purse can&apos;t cover this dividend yet. Add gold before the payout.</p>}
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

const fieldClass = "h-9 w-full rounded-[4px] border border-rule bg-floor px-3 text-[13px] text-paper focus:outline-none focus:border-zinc-500";

// Founder's two balances side by side, and a form to move gold between them
export function TreasuryPanel({
  company,
  userCash,
  dividendDue,
  onDone,
}: {
  company: Company;
  userCash: number;
  dividendDue: number;
  onDone: () => void;
}) {
  const treasury = company.treasuryBalance || 0;
  const [direction, setDirection] = useState<"TO_WALLET" | "TO_COMPANY">("TO_WALLET");
  const [gold, setGold] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const amount = Math.round((parseFloat(gold) || 0) * 100) / 100;
  const source = direction === "TO_WALLET" ? treasury : userCash;
  const frozen = direction === "TO_WALLET" && company.status !== "ACTIVE";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    if (amount <= 0) {
      setResult({ ok: false, message: "Enter how much gold to move." });
      return;
    }
    if (amount > source + 0.000001) {
      setResult({ ok: false, message: direction === "TO_WALLET" ? "The treasury doesn't hold that much." : "Your purse doesn't hold that much." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/companies/${company.ticker}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move_gold", direction, amount, note: note.trim() || undefined }),
      });
      const data = await res.json();
      setResult({ ok: !!data.success, message: data.message || (data.success ? "Moved." : "The move failed.") });
      if (data.success) {
        setGold("");
        setNote("");
        onDone();
      }
    } catch {
      setResult({ ok: false, message: "Couldn't reach the exchange. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const tile = (label: string, value: number, from: boolean) => (
    <div className={`rounded-[4px] border px-3 py-2.5 ${from ? "border-zinc-500 bg-pane" : "border-rule"}`}>
      <div className="text-[11px] text-ash">{label}</div>
      <div className="condensed tabular text-[22px] leading-tight font-bold text-zinc-50">
        {fmtGold(value)} <span className="text-[12px] font-normal text-ash">gold</span>
      </div>
    </div>
  );

  return (
    <section aria-labelledby="treasury-title" className="flex flex-col gap-3">
      <h3 id="treasury-title" className="text-[13px] font-semibold text-zinc-50">Treasury and purse</h3>
      <div className="grid grid-cols-2 gap-2">
        {tile(`${company.ticker} treasury`, treasury, direction === "TO_WALLET")}
        {tile("Your purse", userCash, direction === "TO_COMPANY")}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3 text-[13px]">
        <div role="radiogroup" aria-label="Direction" className="grid grid-cols-2 rounded-[4px] border border-rule p-0.5">
          {([
            ["TO_WALLET", "To my purse"],
            ["TO_COMPANY", `Into ${company.ticker}`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={direction === value}
              onClick={() => {
                setDirection(value);
                setResult(null);
              }}
              className={`h-8 rounded-[3px] text-[13px] ${direction === value ? "bg-rule text-zinc-50 font-semibold" : "text-ash hover:text-paper"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-[12px] text-ash">
            Gold to move
            <button type="button" className="hover:text-paper" onClick={() => setGold(String(Math.floor(source * 100) / 100))}>
              Max {fmtGold(source)}
            </button>
          </span>
          <span className="relative">
            <input type="number" inputMode="decimal" min="0.01" step="0.01" value={gold} onChange={(e) => setGold(e.target.value)} placeholder="0" className={inputClass} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ash pointer-events-none">gold</span>
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-ash">Note for shareholders (optional)</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder={direction === "TO_WALLET" ? "e.g. casino bankroll top-up" : "e.g. this week's profit"} className={fieldClass} />
        </label>
        {frozen && <p className="text-[12px] text-bear">The operator froze this treasury while {company.ticker} is halted.</p>}
        {result && <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-paper" : "text-bear"}>{result.message}</p>}
        <button type="submit" disabled={busy || frozen || source <= 0} className="h-10 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-semibold disabled:opacity-50">
          {busy
            ? "Moving…"
            : direction === "TO_WALLET"
            ? `Move ${amount > 0 ? fmtGold(amount) + " " : ""}gold to my purse`
            : `Move ${amount > 0 ? fmtGold(amount) + " " : ""}gold into ${company.ticker}`}
        </button>
        <p className="text-[12px] text-ash leading-relaxed">
          Every move shows in the {company.ticker} ledger.
          {dividendDue > 0 && ` A ${fmtGold(dividendDue)}-gold dividend is due on Friday: it's paid from the treasury first, then your purse.`}
        </p>
      </form>
    </section>
  );
}

// What a founder can change after listing; ticker, shares, float and IPO price stay as approved
export function CompanyProfileForm({ company, discordHandle, onDone }: { company: Company; discordHandle: string; onDone: () => void }) {
  const initial = {
    name: company.name,
    logoUrl: company.logoUrl,
    sector: company.sector,
    weeklyRevenue: String(company.weeklyRevenue || 0),
    discordHandle,
    description: company.description,
  };
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const set = (k: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setResult(null);
  };
  const changed = (Object.keys(initial) as (keyof typeof initial)[]).filter((k) => form[k] !== initial[k]);
  const sectors = SECTORS.includes(company.sector) ? SECTORS : [company.sector, ...SECTORS];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changed.length === 0) return;
    setBusy(true);
    setResult(null);
    const body: Record<string, string | number> = { action: "update_profile" };
    for (const k of changed) body[k] = k === "weeklyRevenue" ? Number(form.weeklyRevenue) || 0 : form[k];
    try {
      const res = await fetch(`/api/companies/${company.ticker}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setResult({ ok: !!data.success, message: data.success ? "Saved." : data.message || "Saving failed." });
      if (data.success) onDone();
    } catch {
      setResult({ ok: false, message: "Couldn't reach the exchange. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="profile-title" className="flex flex-col gap-3">
      <h3 id="profile-title" className="text-[13px] font-semibold text-zinc-50">Company profile</h3>
      <form onSubmit={submit} className="grid grid-cols-[4.5rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-3 text-[13px]">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-ash">Logo</span>
          <input type="text" value={form.logoUrl} onChange={set("logoUrl")} maxLength={16} className={`${fieldClass} text-center text-lg`} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[12px] text-ash">Name</span>
          <input type="text" value={form.name} onChange={set("name")} maxLength={60} required className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 col-span-2 sm:col-span-1 sm:col-start-2">
          <span className="text-[12px] text-ash">Sector</span>
          <select value={form.sector} onChange={set("sector")} className={fieldClass}>
            {sectors.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 col-span-2 sm:col-span-1">
          <span className="text-[12px] text-ash">Estimated weekly revenue</span>
          <span className="relative">
            <input type="number" inputMode="decimal" min="0" step="0.01" value={form.weeklyRevenue} onChange={set("weeklyRevenue")} className={`${fieldClass} pr-12 text-right`} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ash pointer-events-none">gold</span>
          </span>
        </label>
        <label className="flex flex-col gap-1 col-span-2 sm:col-span-3">
          <span className="text-[12px] text-ash">Discord handle (only the operator sees it)</span>
          <input type="text" value={form.discordHandle} onChange={set("discordHandle")} maxLength={40} placeholder="username" className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 col-span-2 sm:col-span-3">
          <span className="text-[12px] text-ash">Description</span>
          <textarea value={form.description} onChange={set("description")} maxLength={1000} rows={4} required className="w-full rounded-[4px] border border-rule bg-floor px-3 py-2 text-[13px] text-paper leading-relaxed focus:outline-none focus:border-zinc-500" />
        </label>
        <div className="col-span-2 sm:col-span-3 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || changed.length === 0} className="h-9 px-4 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor text-[13px] font-semibold disabled:opacity-50">
            {busy ? "Saving…" : "Save changes"}
          </button>
          {result && <span role={result.ok ? "status" : "alert"} className={result.ok ? "text-paper" : "text-bear"}>{result.message}</span>}
        </div>
        <p className="col-span-2 sm:col-span-3 text-[12px] text-ash">Ticker, share count, float and IPO price stay as listed.</p>
      </form>
    </section>
  );
}
