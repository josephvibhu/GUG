"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  PlusCircle, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  Percent, 
  Copy, 
  Check, 
  BookOpen, 
  Filter,
  Calendar,
  AlertCircle
} from "lucide-react";
import { fmtGold } from "@/lib/format";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, CompanyLedgerEntry, CompanyLedgerSummary } from "@/lib/ledgerCategories";

interface Props {
  ticker: string;
  isFounderOrAdmin?: boolean;
}

export default function CompanyLedger({ ticker, isFounderOrAdmin }: Props) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<CompanyLedgerEntry[]>([]);
  const [summary, setSummary] = useState<CompanyLedgerSummary | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [entryType, setEntryType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [category, setCategory] = useState<string>(INCOME_CATEGORIES[0].value);
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedDiscord, setCopiedDiscord] = useState(false);

  const fetchLedger = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/companies/${ticker}/ledger`, { cache: "no-store" });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Failed to load company ledger.");
        return;
      }
      setEntries(data.entries || []);
      setSummary(data.summary || null);
      if (data.company) setCompany(data.company);
    } catch (err: any) {
      setError(err.message || "Network error loading ledger.");
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // Handle entry submission
  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormMsg({ type: "error", text: "Please enter a valid gold amount greater than 0." });
      return;
    }

    if (!description.trim()) {
      setFormMsg({ type: "error", text: "Please provide a transaction description." });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/companies/${ticker}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          entryType,
          category,
          amount: numAmount,
          description: description.trim(),
          entryDate,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormMsg({ type: "error", text: data.message || "Failed to add ledger entry." });
        return;
      }

      setFormMsg({ type: "success", text: data.message });
      setAmount("");
      setDescription("");
      await fetchLedger();
      setTimeout(() => setFormMsg(null), 4000);
    } catch (err: any) {
      setFormMsg({ type: "error", text: err.message || "Network error submitting entry." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm("Are you sure you want to remove this ledger entry?")) return;
    try {
      const res = await fetch(`/api/companies/${ticker}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", entryId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.message || "Failed to delete entry.");
        return;
      }
      await fetchLedger();
    } catch (err: any) {
      alert(err.message || "Failed to delete entry.");
    }
  };

  const copyDiscordBulletin = () => {
    if (!summary) return;
    const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const sign = summary.netProfit >= 0 ? "+" : "−";
    
    // Top 5 recent entries
    const recentLines = entries.slice(0, 5).map(e => {
      const typeIcon = e.entryType === "INCOME" ? "🟢" : "🔴";
      const amtSign = e.entryType === "INCOME" ? "+" : "−";
      return `• \`${e.entryDate}\` ${typeIcon} **${amtSign}${e.amount.toLocaleString()}g** — ${e.description}`;
    }).join("\n");

    const text = `📊 **$${ticker} Official Enterprise Financial Ledger**
🏛️ **Company:** ${company?.name || ticker}
📅 **Updated:** ${dateStr}

💰 **Total Revenue:** ${summary.totalIncome.toLocaleString()} gold
💸 **Total Expenses:** ${summary.totalExpense.toLocaleString()} gold
📈 **Net Operating Profit:** ${sign}${Math.abs(summary.netProfit).toLocaleString()} gold (${summary.profitMargin > 0 ? "+" : ""}${summary.profitMargin}%)
📦 **Recorded Transactions:** ${summary.entriesCount}

**Recent Transactions:**
${recentLines || "• No transactions recorded yet."}

🔗 *Track real-time company finances at:* https://gug.vercel.app/trade/${ticker}`;

    navigator.clipboard.writeText(text);
    setCopiedDiscord(true);
    setTimeout(() => setCopiedDiscord(false), 2500);
  };

  // Filtered entries
  const filteredEntries = entries.filter((e) => {
    if (filterType !== "ALL" && e.entryType !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.userName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const categoryOptions = entryType === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const getCategoryLabel = (type: "INCOME" | "EXPENSE", val: string) => {
    const list = type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    return list.find((c) => c.value === val)?.label || val;
  };

  if (loading && !summary) {
    return (
      <div className="p-8 text-center text-ash text-[13px] flex items-center justify-center gap-2">
        <div className="w-4 h-4 border-2 border-bullion border-t-transparent rounded-full animate-spin" />
        Loading company financial ledger…
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="p-6 text-center text-bear text-[13px] flex items-center justify-center gap-2">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5">
      {/* Financial Health Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-[4px] bg-pane border border-rule flex flex-col">
          <span className="text-[11px] text-ash flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-bull" /> Total Revenue
          </span>
          <span className="text-[17px] font-bold text-bull mt-1">
            +{fmtGold(summary?.totalIncome || 0)} <span className="text-[11px] font-normal text-ash">gold</span>
          </span>
        </div>

        <div className="p-3.5 rounded-[4px] bg-pane border border-rule flex flex-col">
          <span className="text-[11px] text-ash flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-bear" /> Total Expenses
          </span>
          <span className="text-[17px] font-bold text-bear mt-1">
            -{fmtGold(summary?.totalExpense || 0)} <span className="text-[11px] font-normal text-ash">gold</span>
          </span>
        </div>

        <div className="p-3.5 rounded-[4px] bg-pane border border-rule flex flex-col">
          <span className="text-[11px] text-ash flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-bullion" /> Net Profit
          </span>
          <span className={`text-[17px] font-bold mt-1 ${(summary?.netProfit || 0) >= 0 ? "text-bullion" : "text-bear"}`}>
            {(summary?.netProfit || 0) >= 0 ? "+" : "−"}
            {fmtGold(Math.abs(summary?.netProfit || 0))} <span className="text-[11px] font-normal text-ash">gold</span>
          </span>
        </div>

        <div className="p-3.5 rounded-[4px] bg-pane border border-rule flex flex-col">
          <span className="text-[11px] text-ash flex items-center gap-1">
            <Percent className="w-3.5 h-3.5 text-paper" /> Profit Margin
          </span>
          <span className={`text-[17px] font-bold mt-1 ${(summary?.profitMargin || 0) >= 0 ? "text-paper" : "text-bear"}`}>
            {summary?.profitMargin ? `${summary.profitMargin > 0 ? "+" : ""}${summary.profitMargin}%` : "0.0%"}
          </span>
        </div>
      </div>

      {/* Action / Toolbar header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-zinc-50 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-bullion" />
            General Ledger Records
            <span className="text-[11px] font-normal text-ash">({summary?.entriesCount || 0})</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyDiscordBulletin}
            className="h-8 px-3 rounded-[4px] border border-rule hover:border-zinc-500 text-[12px] text-paper flex items-center gap-1.5 transition-colors"
          >
            {copiedDiscord ? <Check className="w-3.5 h-3.5 text-bull" /> : <Copy className="w-3.5 h-3.5 text-ash" />}
            {copiedDiscord ? "Copied Bulletin!" : "Copy Discord Update"}
          </button>

          {isFounderOrAdmin && (
            <button
              type="button"
              onClick={() => {
                setShowForm(!showForm);
                setFormMsg(null);
              }}
              className="h-8 px-3 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor text-[12px] font-semibold flex items-center gap-1.5 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              {showForm ? "Close Form" : "Record Entry"}
            </button>
          )}
        </div>
      </div>

      {/* Founder / Operator Add Entry Form */}
      {showForm && isFounderOrAdmin && (
        <form
          onSubmit={handleAddEntry}
          className="p-4 rounded-[4px] bg-pane/80 border border-bullion/30 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between border-b border-rule pb-2">
            <h3 className="text-[13px] font-semibold text-zinc-50">
              Record Financial Entry for ${ticker}
            </h3>
            <span className="text-[11px] text-ash">Official Founder Bookkeeping</span>
          </div>

          {formMsg && (
            <div
              className={`p-2.5 rounded-[4px] text-[12px] ${
                formMsg.type === "success"
                  ? "bg-bull/10 border border-bull/30 text-bull"
                  : "bg-bear/10 border border-bear/30 text-bear"
              }`}
            >
              {formMsg.text}
            </div>
          )}

          {/* Type Toggle: Income vs Expense */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setEntryType("INCOME");
                setCategory(INCOME_CATEGORIES[0].value);
              }}
              className={`py-2 px-3 rounded-[4px] text-[12px] font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                entryType === "INCOME"
                  ? "bg-bull/20 border-bull text-bull shadow-sm"
                  : "bg-pane border-rule text-ash hover:text-paper"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              + Income / Revenue
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryType("EXPENSE");
                setCategory(EXPENSE_CATEGORIES[0].value);
              }}
              className={`py-2 px-3 rounded-[4px] text-[12px] font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                entryType === "EXPENSE"
                  ? "bg-bear/20 border-bear text-bear shadow-sm"
                  : "bg-pane border-rule text-ash hover:text-paper"
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              − Expense / Operational Cost
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-ash">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-9 px-2.5 rounded-[4px] bg-floor border border-rule text-paper text-[12px] focus:outline-none focus:border-bullion"
              >
                {categoryOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-ash flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Entry Date (UTC)
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="h-9 px-2.5 rounded-[4px] bg-floor border border-rule text-paper text-[12px] focus:outline-none focus:border-bullion"
              />
            </div>
          </div>

          {/* Amount with quick presets */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-ash">Amount (Gold)</label>
              <div className="flex gap-1">
                {[100, 250, 500, 1000, 5000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset.toString())}
                    className="px-1.5 py-0.5 rounded-[3px] bg-floor border border-rule text-[10px] text-ash hover:text-paper hover:border-zinc-500"
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="e.g. 750"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-9 pl-3 pr-14 rounded-[4px] bg-floor border border-rule text-zinc-50 text-[13px] font-mono focus:outline-none focus:border-bullion"
              />
              <span className="absolute right-3 top-2.5 text-[11px] text-ash">GOLD</span>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-ash">Description / Transaction Memo</label>
            <input
              type="text"
              placeholder={
                entryType === "INCOME"
                  ? "e.g. Sold 150 iron bars to Royal Armoury via market"
                  : "e.g. Daily wages paid to 8 smelter artisans & fuel coal purchase"
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9 px-3 rounded-[4px] bg-floor border border-rule text-paper text-[12px] focus:outline-none focus:border-bullion"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="h-9 mt-1 rounded-[4px] bg-bullion hover:bg-amber-300 disabled:opacity-50 text-floor text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-floor border-t-transparent rounded-full animate-spin" />
                Recording to Ledger…
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                Record {entryType === "INCOME" ? "+ Income" : "− Expense"} in Ledger
              </>
            )}
          </button>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <div className="flex items-center gap-1 bg-pane border border-rule rounded-[4px] p-0.5">
          <button
            type="button"
            onClick={() => setFilterType("ALL")}
            className={`px-2.5 py-1 rounded-[3px] transition-colors ${
              filterType === "ALL" ? "bg-floor text-zinc-50 font-medium" : "text-ash hover:text-paper"
            }`}
          >
            All ({entries.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("INCOME")}
            className={`px-2.5 py-1 rounded-[3px] transition-colors ${
              filterType === "INCOME" ? "bg-floor text-bull font-medium" : "text-ash hover:text-paper"
            }`}
          >
            Income ({entries.filter((e) => e.entryType === "INCOME").length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("EXPENSE")}
            className={`px-2.5 py-1 rounded-[3px] transition-colors ${
              filterType === "EXPENSE" ? "bg-floor text-bear font-medium" : "text-ash hover:text-paper"
            }`}
          >
            Expenses ({entries.filter((e) => e.entryType === "EXPENSE").length})
          </button>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search memo or category…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-3 pr-7 rounded-[4px] bg-floor border border-rule text-paper text-[12px] placeholder:text-ash/60 focus:outline-none focus:border-zinc-500 w-[200px]"
          />
          <Filter className="w-3 h-3 text-ash absolute right-2.5 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Ledger Records Table */}
      <div className="border border-rule rounded-[4px] overflow-x-auto">
        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-ash text-[13px] flex flex-col items-center gap-2">
            <BookOpen className="w-7 h-7 text-ash/40" />
            <span>No financial entries match your filters.</span>
            {isFounderOrAdmin && (
              <span className="text-[11px] text-bullion">
                Click &ldquo;Record Entry&rdquo; above to log your first income or expense transaction.
              </span>
            )}
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-ash text-left border-b border-rule bg-pane/40">
                <th scope="col" className="font-normal py-2.5 pl-4 pr-2">Date</th>
                <th scope="col" className="font-normal py-2.5 px-2">Type</th>
                <th scope="col" className="font-normal py-2.5 px-2">Category</th>
                <th scope="col" className="font-normal py-2.5 px-2">Description</th>
                <th scope="col" className="font-normal py-2.5 px-2 hidden sm:table-cell">By</th>
                <th scope="col" className="font-normal py-2.5 px-2 text-right">Amount</th>
                {isFounderOrAdmin && <th scope="col" className="font-normal py-2.5 pl-2 pr-4 text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => {
                const isIncome = entry.entryType === "INCOME";
                return (
                  <tr key={entry.id} className="border-b border-rule last:border-0 hover:bg-pane/50 transition-colors">
                    <td className="py-2.5 pl-4 pr-2 text-ash whitespace-nowrap">{entry.entryDate}</td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold border ${
                          isIncome
                            ? "bg-bull/10 border-bull/30 text-bull"
                            : "bg-bear/10 border-bear/30 text-bear"
                        }`}
                      >
                        {isIncome ? "+ INCOME" : "− EXPENSE"}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-paper whitespace-nowrap">
                      {getCategoryLabel(entry.entryType, entry.category)}
                    </td>
                    <td className="py-2.5 px-2 text-paper max-w-[260px] truncate" title={entry.description}>
                      {entry.description}
                    </td>
                    <td className="py-2.5 px-2 text-ash whitespace-nowrap hidden sm:table-cell">
                      {entry.userName}
                    </td>
                    <td className={`py-2.5 px-2 text-right font-mono font-medium whitespace-nowrap ${isIncome ? "text-bull" : "text-bear"}`}>
                      {isIncome ? "+" : "−"}{fmtGold(entry.amount)} gold
                    </td>
                    {isFounderOrAdmin && (
                      <td className="py-2.5 pl-2 pr-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-1 text-ash hover:text-bear rounded-[3px] hover:bg-bear/10 transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
