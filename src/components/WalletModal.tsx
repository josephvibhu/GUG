"use client";

import { useState, useEffect } from "react";
import { 
  Coins, 
  ArrowDownLeft, 
  ArrowUpRight, 
  History, 
  Store, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle,
  ShieldCheck,
  Percent,
  X 
} from "lucide-react";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBalanceUpdated: () => void;
  initialTab?: "deposit" | "withdraw" | "history";
}

interface LedgerEntry {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  method: "MARKET_IRON" | "CONTRACT" | "MANUAL_LOAD";
  amount: number;
  ironUnits: number;
  parlamentumName: string;
  status: string;
  recipeNote: string;
  createdAt: string;
}

export default function WalletModal({
  isOpen,
  onClose,
  onBalanceUpdated,
  initialTab = "deposit",
}: WalletModalProps) {
  const [tab, setTab] = useState<"deposit" | "withdraw" | "history">(initialTab);
  const [depositMethod, setDepositMethod] = useState<"MARKET_IRON" | "CONTRACT">("MARKET_IRON");
  
  const [balance, setBalance] = useState<number>(0);
  const [parlamentumName, setParlamentumName] = useState<string>("");
  const [depositAmount, setDepositAmount] = useState<string>("500");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [houseOperator, setHouseOperator] = useState<string>("JosephArora");
  const [ironPrice, setIronPrice] = useState<number>(5);
  const [taxRate, setTaxRate] = useState<number>(10);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchWallet = async () => {
    try {
      const res = await fetch("/api/wallet");
      const data = await res.json();
      if (data.success) {
        const bal = Number(data.balance) || 0;
        setBalance(bal);
        setParlamentumName(data.parlamentumName || "");
        setHouseOperator(data.houseOperator || "JosephArora");
        setIronPrice(data.ironPrice || 5);
        setTaxRate(data.taxRate || 10);
        setLedger(data.ledger || []);

        // Percentage-based autofill for withdrawal
        if (bal < 20) {
          setWithdrawAmount(bal > 0 ? bal.toString() : "");
        } else {
          // Default to 50% of available balance (minimum 20 gold)
          const defaultWithdraw = Math.max(20, Math.floor(bal * 0.5));
          setWithdrawAmount(defaultWithdraw.toString());
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWallet();
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const numDeposit = parseInt(depositAmount, 10) || 0;
  const numWithdraw = parseInt(withdrawAmount, 10) || 0;

  // Deposit Calculations (Raw Iron at 5g each)
  const depositIronUnits = Math.max(1, Math.ceil(numDeposit / ironPrice));
  const depositGrossTotal = depositIronUnits * ironPrice;

  // Withdrawal Calculations (Tax Negation Formula: Gross = Net / (1 - TaxRate))
  const tDecimal = Math.max(0, Math.min(50, taxRate)) / 100;
  const withdrawGross = tDecimal < 1 ? Math.round((numWithdraw / (1 - tDecimal)) * 100) / 100 : numWithdraw;
  const withdrawTaxNegated = Math.round((withdrawGross - numWithdraw) * 100) / 100;
  const withdrawIronUnits = numWithdraw >= 100 ? 100 : Math.max(10, Math.ceil(numWithdraw / ironPrice));
  const withdrawUnitPrice = Math.round((withdrawGross / withdrawIronUnits) * 100) / 100;

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (numDeposit < 5) {
      setFeedback({ type: "error", message: `Minimum deposit is ${ironPrice} gold (1 Raw Iron).` });
      return;
    }
    if (!parlamentumName.trim()) {
      setFeedback({ type: "error", message: "Enter your exact Parlamentum character name." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deposit",
          amount: depositGrossTotal,
          method: depositMethod,
          parlamentumName: parlamentumName.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        setBalance(data.newBalance);
        onBalanceUpdated();
        window.dispatchEvent(new Event("wallet_updated"));
        fetchWallet();
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to process deposit." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Network error" });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (numWithdraw < 20) {
      setFeedback({ type: "error", message: "Minimum cash out is 20 gold. You need at least 20 gold to withdraw." });
      return;
    }
    if (numWithdraw > balance) {
      setFeedback({ type: "error", message: `You only have ${balance.toLocaleString()} gold available in your purse.` });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "withdraw",
          amount: numWithdraw,
          method: "MARKET_IRON",
          parlamentumName: parlamentumName.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        setBalance(data.newBalance);
        onBalanceUpdated();
        window.dispatchEvent(new Event("wallet_updated"));
        fetchWallet();
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to process withdrawal." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Network error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200 font-sans">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden text-xs">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header & Balance */}
        <div className="pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-amber-400 font-semibold mb-1">
            <Coins className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Parlamentum Gold Purse
            </h2>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] text-zinc-400">
              Transfer funds via <strong className="text-zinc-200">Raw Iron ({ironPrice}g each)</strong> with automatic tax negation.
            </p>
            <div className="text-right">
              <span className="text-[10px] text-zinc-400 uppercase font-sans">Purse Balance</span>
              <div className="font-mono text-base font-bold text-emerald-400">
                {balance.toLocaleString()} gold
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800 my-4 shrink-0">
          <button
            type="button"
            onClick={() => {
              setTab("deposit");
              setFeedback(null);
            }}
            className={`py-2 text-center font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              tab === "deposit"
                ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Put Gold In
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("withdraw");
              setFeedback(null);
            }}
            className={`py-2 text-center font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              tab === "withdraw"
                ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Take Gold Out
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("history");
              setFeedback(null);
            }}
            className={`py-2 text-center font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              tab === "history"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Ledger
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-xl mb-3 flex items-start gap-2 border leading-relaxed shrink-0 ${
              feedback.type === "success"
                ? "bg-emerald-950/60 border-emerald-600/40 text-emerald-300"
                : "bg-rose-950/60 border-rose-600/40 text-rose-300"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="text-[11px]">{feedback.message}</div>
          </div>
        )}

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
          {/* TAB 1: PUT GOLD IN (DEPOSIT) */}
          {tab === "deposit" && (
            <form onSubmit={handleDepositSubmit} className="flex flex-col gap-4">
              {/* Method Toggle: On the Market (Raw Iron) / By Contract */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDepositMethod("MARKET_IRON")}
                  className={`flex-1 p-2 rounded-lg border text-left transition cursor-pointer ${
                    depositMethod === "MARKET_IRON"
                      ? "bg-zinc-800 border-amber-500/40 text-white"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <div className="font-semibold flex items-center gap-1.5 text-xs text-amber-300">
                    <Store className="w-3.5 h-3.5" /> Market (Raw Iron @ 5g)
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    Buy Raw Iron listed by {houseOperator}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDepositMethod("CONTRACT")}
                  className={`flex-1 p-2 rounded-lg border text-left transition cursor-pointer ${
                    depositMethod === "CONTRACT"
                      ? "bg-zinc-800 border-amber-500/40 text-white"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <div className="font-semibold flex items-center gap-1.5 text-xs text-amber-300">
                    <FileText className="w-3.5 h-3.5" /> In-Game Contract
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    Send direct courier contract
                  </div>
                </button>
              </div>

              {/* Exact Recipe Box */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 text-[11px] leading-relaxed">
                <div className="font-bold text-white text-xs mb-2 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                  Deposit Instructions:
                </div>

                {depositMethod === "MARKET_IRON" ? (
                  <div className="space-y-1.5 text-zinc-300">
                    <div>1. In <strong>Parlamentum</strong>, open the commodity market.</div>
                    <div>
                      2. Buy <strong className="text-amber-400">{depositIronUnits} Raw Iron</strong> listed by{" "}
                      <span className="font-mono font-bold text-emerald-400">
                        {houseOperator}
                      </span>.
                    </div>
                    <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-zinc-200">
                      <span>Rate: <strong className="text-amber-400">{ironPrice} gold</strong> per Raw Iron</span>
                      <span>·</span>
                      <span>Total Gold: <strong className="text-emerald-400">{depositGrossTotal.toLocaleString()} gold</strong></span>
                    </div>
                    <div className="text-zinc-400 text-[10px] pt-1">
                      Purchase using citizen <span className="font-mono text-zinc-300">{parlamentumName || "your account"}</span>. 
                      Click below after purchase to immediately credit your purse.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-zinc-300 font-mono text-[11px]">
                    <div>To: <strong className="text-amber-400">{houseOperator}</strong></div>
                    <div>You give: <strong className="text-white">{depositGrossTotal.toLocaleString()} gold + 1 courier ticket</strong></div>
                    <div>You get: <strong className="text-white">1 Raw Iron</strong></div>
                    <div>Note: <strong className="text-zinc-400">Exchange deposit for {parlamentumName || "Citizen"}</strong></div>
                  </div>
                )}
              </div>

              {/* Character Name & Amount Inputs */}
              <div>
                <label className="text-zinc-300 font-semibold block mb-1">
                  Your In-Game Character Name
                </label>
                <input
                  type="text"
                  value={parlamentumName}
                  onChange={(e) => setParlamentumName(e.target.value)}
                  placeholder="Exact Parlamentum citizen name"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-300 font-semibold mb-1">
                  <span>Target Gold Amount (at {ironPrice}g / Raw Iron)</span>
                  <span className="font-mono text-amber-400 font-bold">
                    = {depositIronUnits} Raw Iron units
                  </span>
                </div>
                <input
                  type="number"
                  min={ironPrice}
                  step={ironPrice}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 font-mono text-emerald-400 font-bold text-sm focus:outline-none focus:border-amber-400"
                />
                <div className="flex gap-1.5 mt-2">
                  {[
                    { label: "10 Iron (50g)", val: 50 },
                    { label: "50 Iron (250g)", val: 250 },
                    { label: "100 Iron (500g)", val: 500 },
                    { label: "200 Iron (1k)", val: 1000 },
                    { label: "500 Iron (2.5k)", val: 2500 },
                    { label: "1k Iron (5k)", val: 5000 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setDepositAmount(preset.val.toString())}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono py-1 rounded text-[10px] cursor-pointer"
                    >
                      +{preset.val >= 1000 ? `${preset.val / 1000}k` : preset.val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs tracking-wide transition shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {loading ? "Confirming with House..." : `I Bought ${depositIronUnits} Raw Iron (${depositGrossTotal.toLocaleString()} Gold) · Credit Purse`}
              </button>
            </form>
          )}

          {/* TAB 2: TAKE GOLD OUT (WITHDRAW WITH TAX NEGATION) */}
          {tab === "withdraw" && (
            <form onSubmit={handleWithdrawSubmit} className="flex flex-col gap-4">
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 text-[11px] leading-relaxed">
                <div className="font-bold text-white text-xs mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-amber-400" />
                    How to Receive Your In-Game Gold:
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Tax Negated ({taxRate}%)
                  </span>
                </div>
                <p className="text-zinc-300 mb-2">
                  List <strong className="text-amber-400">{withdrawIronUnits} Raw Iron</strong> on the Parlamentum market. 
                  The House Operator ({houseOperator}) buys your listing, transferring the gold to your character.
                </p>

                {/* Tax Negation Math Breakdown */}
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between text-zinc-300">
                    <span>You receive (Net target):</span>
                    <strong className="text-emerald-400">{numWithdraw.toLocaleString()} gold</strong>
                  </div>
                  <div className="flex justify-between text-zinc-400 text-[10px]">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3 h-3" /> Parlamentum Market Tax ({taxRate}%):
                    </span>
                    <span className="text-rose-400">-{withdrawTaxNegated.toFixed(2)} gold</span>
                  </div>
                  <div className="flex justify-between text-amber-300 pt-1 border-t border-zinc-800 font-semibold">
                    <span>House Listing Total (Gross):</span>
                    <span>{withdrawGross.toFixed(2)} gold</span>
                  </div>
                  <div className="pt-2 text-[10px] text-zinc-400 leading-normal border-t border-zinc-800/80 font-sans">
                    ✨ <strong className="text-zinc-200">Tax Absorption:</strong> The House pays the extra{" "}
                    <strong className="text-emerald-400">{withdrawTaxNegated.toFixed(2)} gold</strong> for you so that after the game taxes the sale, you keep exactly <strong className="text-white">{numWithdraw.toLocaleString()} gold</strong> in your pocket!
                  </div>
                  <div className="p-2 bg-black/40 rounded border border-zinc-800/60 text-amber-300 font-mono text-[11px] mt-2">
                    Listing Recipe: {withdrawIronUnits} Raw Iron @ {withdrawUnitPrice.toFixed(2)} gold each.
                  </div>
                </div>
              </div>

              {balance < 20 && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Minimum 20 Gold Required to Cash Out</div>
                    <div className="text-[11px] text-zinc-300 mt-0.5">
                      Your purse holds <strong className="text-white font-mono">{balance.toLocaleString()} gold</strong>. An account needs at least 20 gold to withdraw to Parlamentum.
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-zinc-300 font-semibold block mb-1">
                  Recipient Character in Parlamentum
                </label>
                <input
                  type="text"
                  value={parlamentumName}
                  onChange={(e) => setParlamentumName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-300 font-semibold mb-1">
                  <span>Target Net Gold To Receive</span>
                  <span className="font-mono text-zinc-400 text-[11px]">
                    Purse: {balance.toLocaleString()} gold
                  </span>
                </div>
                <input
                  type="number"
                  min="20"
                  max={balance}
                  step="1"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Min 20 gold"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 font-mono text-amber-400 font-bold text-sm focus:outline-none focus:border-amber-400"
                />

                {/* Percentage Suboptions with calculated gold amounts */}
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {[25, 50, 75, 100].map((pct) => {
                    const calcAmount = Math.floor(balance * (pct / 100));
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          if (balance < 20) {
                            setWithdrawAmount(balance.toString());
                          } else {
                            setWithdrawAmount(Math.max(20, calcAmount).toString());
                          }
                        }}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono py-1.5 px-1 rounded text-center transition cursor-pointer border border-zinc-700/60 hover:border-zinc-500"
                      >
                        <div className="text-[11px] font-bold text-amber-300">{pct === 100 ? "Max" : `${pct}%`}</div>
                        <div className="text-[9px] text-zinc-400 truncate">{calcAmount}g</div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-2">
                  <span>ℹ️ Minimum cash out is <strong className="text-zinc-200">20 gold</strong>.</span>
                  {numWithdraw > 0 && numWithdraw < 20 && (
                    <span className="text-rose-400 font-semibold">Needs at least 20 gold to withdraw</span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || balance < 20 || numWithdraw < 20 || numWithdraw > balance}
                className={`w-full py-2.5 rounded-xl font-bold text-xs tracking-wide transition shadow-lg cursor-pointer ${
                  balance < 20 || numWithdraw < 20 || numWithdraw > balance
                    ? "bg-zinc-800 text-zinc-500 border border-zinc-700/60 cursor-not-allowed shadow-none"
                    : "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20"
                }`}
              >
                {loading
                  ? "Requesting House Purchase..."
                  : balance < 20
                  ? "Needs at least 20 gold to withdraw"
                  : numWithdraw < 20
                  ? "Needs at least 20 gold to withdraw"
                  : numWithdraw > balance
                  ? `Exceeds available purse (${balance.toLocaleString()} gold)`
                  : `Withdraw ${numWithdraw.toLocaleString()} Gold Net to Parlamentum`}
              </button>
            </form>
          )}

          {/* TAB 3: PURSE LEDGER HISTORY */}
          {tab === "history" && (
            <div className="flex flex-col gap-2">
              {ledger.length === 0 ? (
                <div className="py-12 text-center text-zinc-400">
                  No deposits or withdrawals in your ledger yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {ledger.map((tx) => {
                    const isDeposit = tx.type === "DEPOSIT";
                    return (
                      <div
                        key={tx.id}
                        className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-start justify-between gap-3 text-[11px]"
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`p-1.5 rounded-lg mt-0.5 ${
                              isDeposit ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                            }`}
                          >
                            {isDeposit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{isDeposit ? "Gold Deposit" : "Gold Withdrawal"}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                                {tx.method === "CONTRACT" ? "Contract" : tx.method === "MANUAL_LOAD" ? "Operator Load" : "Raw Iron (5g)"}
                              </span>
                            </div>
                            <div className="text-zinc-400 text-[10px] mt-0.5">
                              {tx.recipeNote}
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-1">
                              {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>

                        <div className="text-right font-mono shrink-0">
                          <div
                            className={`font-bold text-xs ${
                              isDeposit ? "text-emerald-400" : "text-amber-400"
                            }`}
                          >
                            {isDeposit ? "+" : "-"}{tx.amount.toLocaleString()} gold
                          </div>
                          <span className={`text-[10px] ${tx.status === "COMPLETED" ? "text-emerald-400" : "text-amber-400"}`}>
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Disclaimer */}
        <div className="pt-3 border-t border-zinc-800 text-[10px] text-zinc-400 text-center shrink-0">
          Operated with Parlamentum in-game gold only via Raw Iron @ 5g. No real currency is involved.
        </div>
      </div>
    </div>
  );
}
