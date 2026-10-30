"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { fmtGold } from "@/lib/format";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, TREASURY_LABELS, CompanyLedgerEntry, CompanyLedgerSummary } from "@/lib/ledgerCategories";

interface Props {
  ticker: string;
  isFounderOrAdmin?: boolean;
}

type Filter = "ALL" | "INCOME" | "EXPENSE" | "TREASURY";

const field = "h-9 w-full px-3 rounded-[4px] bg-floor border border-rule text-paper text-[13px] focus:outline-none focus:border-zinc-500";

// A company's books: what the founder reports as revenue and costs, and the exchange's record of treasury moves
export default function CompanyLedger({ ticker, isFounderOrAdmin }: Props) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<CompanyLedgerEntry[]>([]);
  const [summary, setSummary] = useState<CompanyLedgerSummary | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [entryType, setEntryType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [category, setCategory] = useState<string>(INCOME_CATEGORIES[0].value);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchLedger = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/companies/${ticker}/ledger`, { cache: "no-store" });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "The ledger didn't load.");
        return;
      }
      setEntries(data.entries || []);
      setSummary(data.summary || null);
      if (data.company) setCompanyName(data.company.name);
    } catch {
      setError("Couldn't reach the exchange. Reload to try again.");
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const isTreasury = (e: CompanyLedgerEntry) => !!TREASURY_LABELS[e.category];
  const categoryLabel = (e: CompanyLedgerEntry) =>
    TREASURY_LABELS[e.category] || (e.entryType === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).find((c) => c.value === e.category)?.label || e.category;

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    const num = parseFloat(amount);
    if (!(num > 0)) {
      setFormMsg({ ok: false, text: "Enter an amount above 0." });
      return;
    }
    if (!description.trim()) {
      setFormMsg({ ok: false, text: "Say what the entry is for." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${ticker}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", entryType, category, amount: num, description: description.trim(), entryDate }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormMsg({ ok: false, text: data.message || "The entry wasn't recorded." });
        return;
      }
      setFormMsg({ ok: true, text: "Recorded." });
      setAmount("");
      setDescription("");
      await fetchLedger();
    } catch {
      setFormMsg({ ok: false, text: "Couldn't reach the exchange. Try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm("Delete this ledger entry?")) return;
    try {
      const res = await fetch(`/api/companies/${ticker}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", entryId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) setFormMsg({ ok: false, text: data.message || "The entry wasn't deleted." });
      await fetchLedger();
    } catch {
      setFormMsg({ ok: false, text: "Couldn't reach the exchange. Try again." });
    }
  };

  const copyBulletin = async () => {
    if (!summary) return;
    const sign = summary.netProfit >= 0 ? "+" : "−";
    const recent = entries
      .slice(0, 5)
      .map((e) => `• \`${e.entryDate}\` ${e.entryType === "INCOME" ? "+" : "−"}${e.amount.toLocaleString()}g ${e.description}`)
      .join("\n");
    const text = `📊 **$${ticker} books** (${companyName || ticker}), ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
💰 Revenue: ${summary.totalIncome.toLocaleString()} gold
💸 Costs: ${summary.totalExpense.toLocaleString()} gold
📈 Profit: ${sign}${Math.abs(summary.netProfit).toLocaleString()} gold
🏦 Treasury: ${(summary.treasuryBalance || 0).toLocaleString()} gold
${recent || "• No entries yet."}
🔗 ${window.location.origin}/company/${ticker}/ledger`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setFormMsg({ ok: false, text: "Copying isn't allowed here." });
    }
  };

  const shown = entries.filter((e) => {
    if (filter === "TREASURY" && !isTreasury(e)) return false;
    if ((filter === "INCOME" || filter === "EXPENSE") && (isTreasury(e) || e.entryType !== filter)) return false;
    const q = search.trim().toLowerCase();
    return !q || [e.description, categoryLabel(e), e.userName].some((v) => v.toLowerCase().includes(q));
  });

  if (loading && !summary) return <p className="p-4 text-[13px] text-ash">Loading the ledger…</p>;
  if (error && !summary) return <p role="alert" className="p-4 text-[13px] text-bear">{error}</p>;

  const s = summary || { totalIncome: 0, totalExpense: 0, netProfit: 0, profitMargin: 0, entriesCount: 0, treasuryBalance: 0 };
  const counts: Record<Filter, number> = {
    ALL: entries.length,
    INCOME: entries.filter((e) => !isTreasury(e) && e.entryType === "INCOME").length,
    EXPENSE: entries.filter((e) => !isTreasury(e) && e.entryType === "EXPENSE").length,
    TREASURY: entries.filter(isTreasury).length,
  };

  return (
    <div className="flex flex-col gap-5 p-4">
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-rule border border-rule rounded-[4px] overflow-hidden">
        {[
          ["Treasury", fmtGold(s.treasuryBalance || 0), "text-bullion"],
          ["Revenue", fmtGold(s.totalIncome), "text-zinc-50"],
          ["Costs", fmtGold(s.totalExpense), "text-zinc-50"],
          ["Profit", `${s.netProfit < 0 ? "−" : ""}${fmtGold(Math.abs(s.netProfit))}`, s.netProfit < 0 ? "text-bear" : "text-zinc-50"],
        ].map(([label, value, tone]) => (
          <div key={label} className="bg-floor px-3 py-2.5">
            <dt className="text-[12px] text-ash">{label}</dt>
            <dd className={`condensed tabular text-[19px] font-bold leading-tight ${tone}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[12px] text-ash -mt-3 leading-relaxed">
        Gold. Revenue and costs are what the founder reports. Treasury moves (IPO sales, founder transfers, dividends) are recorded by the exchange and
        don&apos;t count towards profit.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copyBulletin} className="h-8 px-3 rounded-[4px] border border-rule hover:border-zinc-500 text-[12px] text-paper flex items-center gap-1.5">
          {copied ? <Check className="h-3.5 w-3.5 text-bull" /> : <Copy className="h-3.5 w-3.5 text-ash" />}
          {copied ? "Copied" : "Copy for Discord"}
        </button>
        {ticker === "GUG" && (
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await fetch("/api/admin/shareholder-report");
                const data = await res.json();
                if (data.success) {
                  const { generateShareholderCardPdf } = await import("@/lib/shareholderCardPdf");
                  generateShareholderCardPdf(data.cardData);
                }
              } catch (e) {
                console.error(e);
              }
            }}
            className="h-8 px-3 rounded-[4px] bg-zinc-900 border border-amber-500/50 hover:border-amber-400 text-amber-300 text-[12px] font-semibold transition cursor-pointer"
            title="Download the official single-page visual Shareholder Report Card for $GUG"
          >
            Shareholder Report (Week 2)
          </button>
        )}
        {isFounderOrAdmin && (
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setFormMsg(null);
            }}
            className="h-8 px-3 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor text-[12px] font-semibold"
          >
            {showForm ? "Close" : "Add an entry"}
          </button>
        )}
      </div>

      {showForm && isFounderOrAdmin && (
        <form onSubmit={handleAddEntry} className="grid grid-cols-2 gap-3 border border-rule rounded-[4px] p-3 text-[13px]">
          <div role="group" aria-label="Entry type" className="col-span-2 grid grid-cols-2 gap-0.5 p-0.5 rounded-[4px] border border-rule">
            {(["INCOME", "EXPENSE"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={entryType === t}
                onClick={() => {
                  setEntryType(t);
                  setCategory((t === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0].value);
                }}
                className={`h-7 rounded-[3px] text-[12px] ${entryType === t ? "bg-rule text-zinc-50 font-semibold" : "text-ash hover:text-paper"}`}
              >
                {t === "INCOME" ? "Revenue" : "Cost"}
              </button>
            ))}
          </div>
          <label className="col-span-2 sm:col-span-1 flex flex-col gap-1">
            <span className="text-[12px] text-ash">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
              {(entryType === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-ash">Date (UTC)</span>
            <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-ash">Amount</span>
            <span className="relative">
              <input type="number" inputMode="decimal" step="any" min="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} pr-12 text-right tabular`} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ash pointer-events-none">gold</span>
            </span>
          </label>
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-[12px] text-ash">What it was</span>
            <input
              type="text"
              maxLength={200}
              placeholder={entryType === "INCOME" ? "e.g. sold 150 iron bars to the Royal Armoury" : "e.g. wages for 8 smelter workers"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={field}
            />
          </label>
          {formMsg && (
            <p role={formMsg.ok ? "status" : "alert"} className={`col-span-2 ${formMsg.ok ? "text-paper" : "text-bear"}`}>
              {formMsg.text}
            </p>
          )}
          <button type="submit" disabled={submitting} className="col-span-2 h-9 rounded-[4px] bg-bullion hover:bg-amber-300 disabled:opacity-50 text-floor font-semibold">
            {submitting ? "Recording…" : `Record ${entryType === "INCOME" ? "revenue" : "cost"}`}
          </button>
        </form>
      )}
      {!showForm && formMsg && !formMsg.ok && <p role="alert" className="text-[13px] text-bear">{formMsg.text}</p>}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" aria-label="Entries" className="flex rounded-[4px] border border-rule p-0.5 text-[12px]">
            {([
              ["ALL", "All"],
              ["INCOME", "Revenue"],
              ["EXPENSE", "Costs"],
              ["TREASURY", "Treasury"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                onClick={() => setFilter(id)}
                className={`h-7 px-2.5 rounded-[3px] ${filter === id ? "bg-rule text-zinc-50 font-semibold" : "text-ash hover:text-paper"}`}
              >
                {label} <span className="tabular opacity-70">{counts[id]}</span>
              </button>
            ))}
          </div>
          <label className="w-full sm:w-56">
            <span className="sr-only">Search entries</span>
            <input type="search" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className={`${field} h-8`} />
          </label>
        </div>

        <ul className="border border-rule rounded-[4px] divide-y divide-rule">
          {shown.length === 0 ? (
            <li className="px-4 py-5 text-[13px] text-ash">
              {entries.length === 0
                ? isFounderOrAdmin
                  ? "No entries yet. Add this week's revenue and costs so shareholders can follow the business."
                  : "The founder hasn't recorded anything yet."
                : "No entry matches."}
            </li>
          ) : (
            shown.map((e) => {
              const treasury = isTreasury(e);
              const plus = e.entryType === "INCOME";
              return (
                <li key={e.id} className="px-3 sm:px-4 py-2.5 flex items-start gap-3 text-[13px]">
                  <div className="min-w-0 flex-1">
                    <div className="text-paper">{e.description}</div>
                    <div className="text-[12px] text-ash">
                      {e.entryDate}, {treasury ? "treasury" : categoryLabel(e).toLowerCase()}
                      {treasury && `: ${categoryLabel(e).toLowerCase()}`}, by {e.userName}
                    </div>
                  </div>
                  <div className={`tabular text-right whitespace-nowrap ${treasury ? "text-bullion" : plus ? "text-bull" : "text-bear"}`}>
                    {plus ? "+" : "−"}
                    {fmtGold(e.amount)}
                  </div>
                  {isFounderOrAdmin && !treasury && (
                    <button type="button" onClick={() => handleDelete(e.id)} aria-label="Delete entry" className="h-6 w-6 -mr-1 flex items-center justify-center rounded-[3px] text-ash hover:text-bear">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
