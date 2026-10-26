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
  Clock,
  MessageSquare,
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
  method: "MARKET_IRON" | "CONTRACT" | "MANUAL_LOAD" | "ADMIN_CREDIT" | string;
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
  const [depositPrice, setDepositPrice] = useState<number>(10);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [houseOperator, setHouseOperator] = useState<string>("JosephArora");
  const [ironPrice, setIronPrice] = useState<number>(10);
  const [taxRate, setTaxRate] = useState<number>(10);
  const [selectedTaxRate, setSelectedTaxRate] = useState<number>(10);
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
        setIronPrice(data.ironPrice || 10);
        setTaxRate(data.taxRate || 10);
        setSelectedTaxRate((prev) => prev !== 10 ? prev : (data.taxRate || 10));
        setLedger(data.ledger || []);

        // Percentage-based autofill for withdrawal (min 100 gold)
        if (bal < 100) {
          setWithdrawAmount(bal > 0 ? bal.toString() : "");
        } else {
          // Default to 50% of available balance (minimum 100 gold)
          const defaultWithdraw = Math.max(100, Math.floor(bal * 0.5));
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

  // Deposit Calculations (Raw Iron at 10g, Raw Cotton at 100g, or Raw Copper at 1,000g)
  const effectiveDepositPrice = depositPrice === 1000 ? 1000 : depositPrice === 100 ? 100 : 10;
  const depositCommodityName = effectiveDepositPrice === 1000 ? "Raw Copper" : effectiveDepositPrice === 100 ? "Raw Cotton" : "Raw Iron";
  const depositIronUnits = Math.max(1, Math.ceil(numDeposit / effectiveDepositPrice));
  const depositGrossTotal = depositIronUnits * effectiveDepositPrice;

  // Withdrawal Calculations: user pays in-game sales tax to Parlamentum
  const tDecimal = Math.max(0, Math.min(50, selectedTaxRate)) / 100;
  const withdrawGross = numWithdraw;
  const withdrawTax = Math.round(withdrawGross * tDecimal * 100) / 100;
  const withdrawNet = Math.max(0, Math.round((withdrawGross - withdrawTax) * 100) / 100);
  const withdrawIronUnits = numWithdraw >= 100 ? 100 : Math.max(1, Math.ceil(numWithdraw / ironPrice));
  const withdrawUnitPrice = Math.round((withdrawGross / withdrawIronUnits) * 100) / 100;
  const isFridayUtc = new Date().getUTCDay() === 5;

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (numDeposit < effectiveDepositPrice) {
      setFeedback({ type: "error", message: `Minimum deposit is ${effectiveDepositPrice} gold (1 Raw Iron).` });
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
          unitPrice: effectiveDepositPrice,
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

    const isFridayUtc = new Date().getUTCDay() === 5;
    if (!isFridayUtc) {
      setFeedback({
        type: "error",
        message: "Withdrawal requests can only be made on Fridays (00:00 – 23:59 UTC) and are processed within 48 hours. Need support? Join https://discord.gg/q3QA6WzHQZ",
      });
      return;
    }

    if (numWithdraw < 100) {
      setFeedback({ type: "error", message: "Minimum cash out is 100 gold. Withdrawal requests must be at least 100 gold." });
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
          taxRate: selectedTaxRate,
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
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center sm:p-4 z-50">
      <div role="dialog" aria-modal="true" className="bg-pane border border-rule rounded-t-[6px] sm:rounded-[6px] w-full sm:max-w-lg p-4 sm:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] relative max-h-[92vh] flex flex-col overflow-hidden text-[13px]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-ash hover:text-zinc-50 p-1 rounded-[4px] hover:bg-zinc-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header & Balance */}
        <div className="pb-4 border-b border-rule">
          <div className="flex items-center gap-2 text-bullion font-semibold mb-1">
            <Coins className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-bold text-zinc-50 tracking-tight">
              Parlamentum Gold Purse
            </h2>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-[12px] text-ash">
              Deposit via <strong className="text-paper">Raw Iron (10g), Cotton (100g), or Copper (1k)</strong>.
            </p>
            <div className="text-right">
              <span className="text-[12px] text-ash font-sans">Purse Balance</span>
              <div className="tabular text-base font-bold text-bullion">
                {balance.toLocaleString()} gold
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-floor rounded-[4px] border border-rule my-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setTab("deposit");
              setFeedback(null);
            }}
            className={`py-2 text-center font-bold rounded-[4px] transition cursor-pointer flex items-center justify-center gap-1.5 ${
              tab === "deposit"
                ? "bg-rule text-zinc-50"
                : "text-ash hover:text-paper"
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
            className={`py-2 text-center font-bold rounded-[4px] transition cursor-pointer flex items-center justify-center gap-1.5 ${
              tab === "withdraw"
                ? "bg-rule text-zinc-50"
                : "text-ash hover:text-paper"
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
            className={`py-2 text-center font-bold rounded-[4px] transition cursor-pointer flex items-center justify-center gap-1.5 ${
              tab === "history"
                ? "bg-zinc-800 text-zinc-50"
                : "text-ash hover:text-paper"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Ledger
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-[4px] mb-3 flex items-start gap-2 border leading-relaxed shrink-0 ${
              feedback.type === "success"
                ? "bg-floor border-rule text-paper"
                : "bg-floor border-rule text-bear"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-bullion shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-bear shrink-0 mt-0.5" />
            )}
            <div className="text-[12px]">{feedback.message}</div>
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
                  className={`flex-1 p-2 rounded-[4px] border text-left transition cursor-pointer ${
                    depositMethod === "MARKET_IRON"
                      ? "bg-zinc-800 border-rule text-zinc-50"
                      : "bg-floor border-rule text-ash hover:text-paper"
                  }`}
                >
                  <div className="font-semibold flex items-center gap-1.5 text-[13px] text-paper">
                    <Store className="w-3.5 h-3.5" /> Market (Raw Iron @ {ironPrice}g)
                  </div>
                  <div className="text-[12px] text-ash mt-0.5">
                    Buy Raw Iron listed by {houseOperator}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDepositMethod("CONTRACT")}
                  className={`flex-1 p-2 rounded-[4px] border text-left transition cursor-pointer ${
                    depositMethod === "CONTRACT"
                      ? "bg-zinc-800 border-rule text-zinc-50"
                      : "bg-floor border-rule text-ash hover:text-paper"
                  }`}
                >
                  <div className="font-semibold flex items-center gap-1.5 text-[13px] text-paper">
                    <FileText className="w-3.5 h-3.5" /> In-Game Contract
                  </div>
                  <div className="text-[12px] text-ash mt-0.5">
                    Send direct courier contract
                  </div>
                </button>
              </div>

              {/* Exact Recipe Box */}
              <div className="bg-floor border border-rule rounded-[4px] p-3.5 text-[12px] leading-relaxed">
                <div className="font-bold text-zinc-50 text-[13px] mb-2 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-bullion" />
                  Deposit Instructions:
                </div>

                {depositMethod === "MARKET_IRON" ? (
                  <div className="space-y-1.5 text-paper">
                    <div>1. In <strong>Parlamentum</strong>, open the commodity market.</div>
                    <div>
                      2. Buy <strong className="text-bullion">{depositIronUnits} {effectiveDepositPrice === 1000 ? "Raw Copper" : effectiveDepositPrice === 100 ? "Raw Cotton" : "Raw Iron"}</strong> listed by{" "}
                      <span className="tabular font-bold text-bullion">
                        {houseOperator}
                      </span>.
                    </div>
                    <div className="flex items-center gap-2 pt-1 tabular text-[12px] text-paper">
                      <span>Rate: <strong className="text-bullion">{effectiveDepositPrice} gold</strong> each</span>
                      <span>·</span>
                      <span>Total Gold: <strong className="text-bullion">{depositGrossTotal.toLocaleString()} gold</strong></span>
                    </div>
                    <div className="text-ash text-[12px] pt-1">
                      Purchase using citizen <span className="tabular text-paper">{parlamentumName || "your account"}</span>. 
                      Click below after purchase to immediately credit your purse.
                    </div>
                    <div className="bg-floor border border-rule rounded-[4px] p-2 text-[12px] text-paper/90 mt-2 flex items-start gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-bullion shrink-0 mt-0.5" />
                      <span>
                        <strong>Parlamentum In-Game Tax Notice:</strong> Parlamentum automatically levies a 5% market sales tax on all in-game market trades. Purse credits reflect 100% of the net gold received by the House.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-paper tabular text-[12px]">
                    <div>To: <strong className="text-bullion">{houseOperator}</strong></div>
                    <div>You give: <strong className="text-zinc-50">{depositGrossTotal.toLocaleString()} gold + 1 courier ticket</strong></div>
                    <div>You get: <strong className="text-zinc-50">1 Raw Iron</strong></div>
                    <div>Note: <strong className="text-ash">Exchange deposit for {parlamentumName || "Citizen"}</strong></div>
                  </div>
                )}
              </div>

              {/* Deposit Commodity Tier Selector: Iron (10g), Cotton (100g), Copper (1000g) */}
              <div className="bg-floor border border-rule rounded-[4px] p-2.5">
                <div className="text-[12px] font-semibold text-paper mb-1.5 flex items-center justify-between">
                  <span>Deposit Commodity Tier</span>
                  <span className="text-[11px] text-bullion font-bold tabular">
                    {depositPrice === 1000 ? "Raw Copper (1,000g)" : depositPrice === 100 ? "Raw Cotton (100g)" : "Raw Iron (10g)"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDepositPrice(10);
                      setDepositAmount("250");
                    }}
                    className={`py-1.5 px-2 rounded-[4px] border text-left transition cursor-pointer ${
                      effectiveDepositPrice === 10
                        ? "bg-bullion/15 border-bullion text-bullion font-bold shadow-sm"
                        : "bg-pane border-rule text-ash hover:text-paper"
                    }`}
                  >
                    <div className="text-[11px] font-bold flex items-center gap-1">
                      <span>🪙</span> Iron (10g)
                    </div>
                    <div className="text-[9px] text-ash mt-0.5">&lt; 500g</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDepositPrice(100);
                      setDepositAmount("1000");
                    }}
                    className={`py-1.5 px-2 rounded-[4px] border text-left transition cursor-pointer ${
                      effectiveDepositPrice === 100
                        ? "bg-bullion/15 border-bullion text-bullion font-bold shadow-sm"
                        : "bg-pane border-rule text-ash hover:text-paper"
                    }`}
                  >
                    <div className="text-[11px] font-bold flex items-center gap-1">
                      <span>🌿</span> Cotton (100g)
                    </div>
                    <div className="text-[9px] text-ash mt-0.5">500g–5k</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDepositPrice(1000);
                      setDepositAmount("5000");
                    }}
                    className={`py-1.5 px-2 rounded-[4px] border text-left transition cursor-pointer ${
                      effectiveDepositPrice === 1000
                        ? "bg-bullion/15 border-bullion text-bullion font-bold shadow-sm"
                        : "bg-pane border-rule text-ash hover:text-paper"
                    }`}
                  >
                    <div className="text-[11px] font-bold flex items-center gap-1">
                      <span>💎</span> Copper (1k)
                    </div>
                    <div className="text-[9px] text-ash mt-0.5">5,000g+</div>
                  </button>
                </div>
              </div>

              {/* Character Name & Amount Inputs */}
              <div>
                <label className="text-paper font-semibold block mb-1">
                  Your In-Game Character Name
                </label>
                <input
                  type="text"
                  value={parlamentumName}
                  onChange={(e) => setParlamentumName(e.target.value)}
                  placeholder="Exact Parlamentum citizen name"
                  className="w-full bg-floor border border-rule rounded-[4px] px-3 py-2 text-zinc-50 tabular focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-paper font-semibold mb-1">
                  <span>Target Gold Amount ({effectiveDepositPrice === 1000 ? "Copper @ 1,000g" : effectiveDepositPrice === 100 ? "Cotton @ 100g" : "Iron @ 10g"})</span>
                  <span className="tabular text-bullion font-bold">
                    = {depositIronUnits} {effectiveDepositPrice === 1000 ? "Copper" : effectiveDepositPrice === 100 ? "Cotton" : "Iron"} {depositIronUnits === 1 ? "unit" : "units"}
                  </span>
                </div>
                <input
                  type="number"
                  min={effectiveDepositPrice}
                  step={effectiveDepositPrice}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full bg-floor border border-rule rounded-[4px] px-3 py-2 tabular text-bullion font-bold text-sm focus:outline-none focus:border-zinc-500"
                />
                <div className="flex gap-1.5 mt-2">
                  {(effectiveDepositPrice === 1000
                    ? [
                        { label: "1k (1 Copper)", val: 1000 },
                        { label: "2k (2 Copper)", val: 2000 },
                        { label: "3k (3 Copper)", val: 3000 },
                        { label: "5k (5 Copper)", val: 5000 },
                        { label: "10k (10 Copper)", val: 10000 },
                        { label: "25k (25 Copper)", val: 25000 },
                      ]
                    : effectiveDepositPrice === 100
                    ? [
                        { label: "500g (5 Cotton)", val: 500 },
                        { label: "1k (10 Cotton)", val: 1000 },
                        { label: "2k (20 Cotton)", val: 2000 },
                        { label: "3k (30 Cotton)", val: 3000 },
                        { label: "5k (50 Cotton)", val: 5000 },
                        { label: "10k (100 Cotton)", val: 10000 },
                      ]
                    : [
                        { label: "100g (10 Iron)", val: 100 },
                        { label: "250g (25 Iron)", val: 250 },
                        { label: "500g (50 Iron)", val: 500 },
                        { label: "1k (100 Iron)", val: 1000 },
                        { label: "2.5k (250 Iron)", val: 2500 },
                        { label: "5k (500 Iron)", val: 5000 },
                      ]
                  ).map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      title={preset.label}
                      onClick={() => setDepositAmount(preset.val.toString())}
                      className="flex-1 bg-floor hover:bg-rule text-paper tabular py-1 rounded text-[12px] cursor-pointer"
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
                className="w-full py-2.5 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-bold text-[13px] transition cursor-pointer"
              >
                {loading ? "Confirming with House..." : `I Bought ${depositIronUnits} ${effectiveDepositPrice === 1000 ? "Raw Copper" : effectiveDepositPrice === 100 ? "Raw Cotton" : "Raw Iron"} (${depositGrossTotal.toLocaleString()} Gold) · Credit Purse`}
              </button>
            </form>
          )}

          {/* TAB 2: TAKE GOLD OUT (WITHDRAW TO PARLAMENTUM) */}
          {tab === "withdraw" && (
            <form onSubmit={handleWithdrawSubmit} className="flex flex-col gap-4">
              {/* Official Friday Withdrawal Policy Banner */}
              <div className={`p-3.5 rounded-[4px] border flex flex-col gap-2 ${
                isFridayUtc
                  ? "bg-bull/10 border-bull/40 text-bull"
                  : "bg-bear/10 border-bear/40 text-bear"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[13px] flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {isFridayUtc ? "Withdrawal Window OPEN (Friday UTC)" : "Withdrawal Window CLOSED (Fridays Only)"}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-floor border border-rule">
                    {isFridayUtc ? "Active Window" : "Opens Friday 00:00 UTC"}
                  </span>
                </div>
                <div className="text-[12px] text-paper space-y-1">
                  <p>• <strong>Friday Requests Only:</strong> Cash-out requests can only be submitted on <strong>Fridays (00:00 – 23:59 UTC)</strong>.</p>
                  <p>• <strong>Minimum Cash Out:</strong> <strong>100 gold minimum</strong> (no requests under 100g accepted).</p>
                  <p>• <strong>48-Hour In-Game Fulfillment:</strong> All Friday requests are reviewed and fulfilled in-game by the House Operator within <strong>48 hours</strong>.</p>
                </div>
              </div>

              {/* Support & Ticket Link */}
              <div className="p-3 bg-floor border border-rule rounded-[4px] flex flex-col gap-1 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-100 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-bullion" />
                    Need Support or Withdrawal Delayed?
                  </span>
                  <span className="text-[11px] text-ash">48h SLA</span>
                </div>
                <p className="text-ash text-[11px] leading-relaxed">
                  If your in-game trade has not been fulfilled within 48 hours or you need assistance with your contract, please join our official Discord server and raise a support ticket:
                </p>
                <a
                  href="https://discord.gg/q3QA6WzHQZ"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bullion underline hover:text-amber-300 font-semibold flex items-center gap-1 text-[12px] mt-0.5"
                >
                  discord.gg/q3QA6WzHQZ ↗ (Raise a Support Ticket)
                </a>
              </div>

              <div className="bg-floor border border-rule rounded-[4px] p-3.5 text-[12px] leading-relaxed">
                <div className="font-bold text-zinc-50 text-[13px] mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-bullion" />
                    How to Receive Your In-Game Gold:
                  </span>
                  <span className="px-2 py-0.5 rounded-[4px] bg-floor border border-rule text-bullion text-[12px] tabular flex items-center gap-1">
                    <Percent className="w-3 h-3 text-ash" /> Regional Tax ({selectedTaxRate}%)
                  </span>
                </div>
                <p className="text-paper mb-2">
                  List <strong className="text-bullion">{withdrawIronUnits} Raw Iron</strong> on the Parlamentum market. 
                  The House Operator ({houseOperator}) buys your listing, transferring the gold to your character.
                </p>

                {/* Withdrawal Math Breakdown */}
                <div className="p-3 bg-pane rounded-[4px] border border-rule space-y-1.5 tabular text-[12px]">
                  <div className="flex justify-between text-paper">
                    <span>Withdrawal Amount (Gross):</span>
                    <strong className="text-bullion">{withdrawGross.toLocaleString()} gold</strong>
                  </div>
                  <div className="flex justify-between text-ash text-[12px]">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3 h-3" /> In-Game Market Tax ({selectedTaxRate}%):
                    </span>
                    <span className="text-bear">-{withdrawTax.toFixed(2)} gold</span>
                  </div>
                  <div className="flex justify-between text-paper pt-1 border-t border-rule font-semibold">
                    <span>Estimated Net Gold Received:</span>
                    <span className="text-bullion">~{withdrawNet.toFixed(2)} gold</span>
                  </div>
                  <div className="pt-2 text-[12px] text-ash leading-normal border-t border-rule font-sans">
                    ℹ️ <strong className="text-paper">In-Game Sales Tax:</strong> The House purchases your listing for the full <strong className="text-paper">{withdrawGross.toLocaleString()} gold</strong>. Parlamentum deducts your region&apos;s {selectedTaxRate}% market tax upon sale, leaving approximately <strong className="text-zinc-50">{withdrawNet.toFixed(2)} gold</strong> in your character purse.
                  </div>
                  <div className="p-2 bg-floor rounded border border-rule text-paper tabular text-[12px] mt-2">
                    Listing Recipe: {withdrawIronUnits} Raw Iron @ {withdrawUnitPrice.toFixed(2)} gold each.
                  </div>
                </div>
              </div>

              {balance < 100 && (
                <div className="p-3 rounded-[4px] bg-floor border border-rule text-paper text-[13px] flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-bullion shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Minimum 100 Gold Required to Cash Out</div>
                    <div className="text-[12px] text-paper mt-0.5">
                      Your purse holds <strong className="text-zinc-50 tabular">{balance.toLocaleString()} gold</strong>. An account needs at least 100 gold to withdraw to Parlamentum.
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-paper font-semibold block mb-1">
                  Recipient Character in Parlamentum
                </label>
                <input
                  type="text"
                  value={parlamentumName}
                  onChange={(e) => setParlamentumName(e.target.value)}
                  className="w-full bg-floor border border-rule rounded-[4px] px-3 py-2 text-zinc-50 tabular focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Regional Market Tax Rate Selector */}
              <div className="bg-floor border border-rule rounded-[4px] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-paper font-semibold text-[13px] flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-bullion" />
                    Regional Market Tax Rate
                  </span>
                  <span className="px-2 py-0.5 rounded bg-floor border border-rule text-paper text-[12px] tabular">
                    {selectedTaxRate}% applied
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[
                    { label: "3% (Kriti)", rate: 3 },
                    { label: "5% (Std)", rate: 5 },
                    { label: "8%", rate: 8 },
                    { label: "10% (Def)", rate: 10 },
                  ].filter((preset) => preset.rate <= taxRate).map((preset) => (
                    <button
                      key={preset.rate}
                      type="button"
                      onClick={() => setSelectedTaxRate(preset.rate)}
                      className={`py-1 px-1 rounded text-[12px] tabular transition border cursor-pointer ${
                        selectedTaxRate === preset.rate
                          ? "bg-rule text-zinc-50 font-semibold border-zinc-500"
                          : "bg-pane border-rule text-ash hover:text-paper"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[12px] text-ash pt-1 border-t border-rule">
                  <span>Your country&apos;s export tax (up to {taxRate}%)</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max={taxRate}
                      step="0.5"
                      value={selectedTaxRate}
                      onChange={(e) => setSelectedTaxRate(Math.max(0, Math.min(taxRate, parseFloat(e.target.value) || 0)))}
                      className="w-16 bg-pane border border-rule rounded px-2 py-0.5 text-[13px] text-paper tabular text-center focus:outline-none focus:border-zinc-500"
                    />
                    <span className="text-ash tabular">%</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-paper font-semibold mb-1">
                  <span>Withdrawal Amount (from purse)</span>
                  <span className="tabular text-ash text-[12px]">
                    Purse: {balance.toLocaleString()} gold
                  </span>
                </div>
                <input
                  type="number"
                  min="100"
                  max={balance}
                  step="1"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Min 100 gold"
                  className="w-full bg-floor border border-rule rounded-[4px] px-3 py-2 tabular text-bullion font-bold text-sm focus:outline-none focus:border-zinc-500"
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
                          if (balance < 100) {
                            setWithdrawAmount(balance.toString());
                          } else {
                            setWithdrawAmount(Math.max(100, calcAmount).toString());
                          }
                        }}
                        className="bg-floor hover:bg-rule text-paper tabular py-1.5 px-1 rounded text-center transition cursor-pointer border border-rule hover:border-zinc-500"
                      >
                        <div className="text-[12px] font-bold text-paper">{pct === 100 ? "Max" : `${pct}%`}</div>
                        <div className="text-[9px] text-ash truncate">{calcAmount}g</div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[12px] text-ash mt-2">
                  <span>ℹ️ Minimum cash out is <strong className="text-paper">100 gold</strong> (Fridays only).</span>
                  {numWithdraw > 0 && numWithdraw < 100 && (
                    <span className="text-bear font-semibold">Needs at least 100 gold</span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !isFridayUtc || balance < 100 || numWithdraw < 100 || numWithdraw > balance}
                className={`w-full py-2.5 rounded-[4px] font-bold text-[13px] transition shadow-lg cursor-pointer ${
                  !isFridayUtc || balance < 100 || numWithdraw < 100 || numWithdraw > balance
                    ? "bg-zinc-800 text-ash border border-rule cursor-not-allowed shadow-none"
                    : "bg-bullion hover:bg-amber-300 text-floor"
                }`}
              >
                {loading
                  ? "Requesting House Purchase..."
                  : !isFridayUtc
                  ? "Withdrawals Closed (Fridays Only)"
                  : balance < 100
                  ? "Minimum 100 gold required to cash out"
                  : numWithdraw < 100
                  ? "Needs at least 100 gold to withdraw"
                  : numWithdraw > balance
                  ? `Exceeds available purse (${balance.toLocaleString()} gold)`
                  : `Withdraw ${numWithdraw.toLocaleString()} Gold (~${withdrawNet.toFixed(2)}g in game) · Fulfilled in 48h`}
              </button>
            </form>
          )}

          {/* TAB 3: PURSE LEDGER HISTORY */}
          {tab === "history" && (
            <div className="flex flex-col gap-2">
              {ledger.length === 0 ? (
                <div className="py-12 text-center text-ash">
                  No deposits or withdrawals in your ledger yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {ledger.map((tx) => {
                    const isDeposit = tx.type === "DEPOSIT";
                    return (
                      <div
                        key={tx.id}
                        className="p-3 bg-floor rounded-[4px] border border-rule flex items-start justify-between gap-3 text-[12px]"
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`p-1.5 rounded-[4px] mt-0.5 ${
                              isDeposit ? "bg-floor text-bullion" : "bg-floor text-bullion"
                            }`}
                          >
                            {isDeposit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>
                          <div>
                            {(() => {
                              const isAdjustment = tx.recipeNote?.toLowerCase().includes("recalibration") || tx.recipeNote?.toLowerCase().includes("adjustment");
                              return (
                                <>
                                  <div className="font-bold text-zinc-50 flex items-center gap-2">
                                    <span>{isDeposit ? "Gold Deposit" : "Gold Withdrawal"}</span>
                                    <span className={`text-[12px] px-1.5 py-0.5 rounded tabular ${
                                      isAdjustment
                                        ? "bg-floor text-paper border border-rule"
                                        : "bg-zinc-800 text-paper"
                                    }`}>
                                      {isAdjustment
                                        ? "Re-credited after tax"
                                        : tx.method === "CONTRACT"
                                        ? "Contract"
                                        : tx.method === "MANUAL_LOAD" || tx.method === "ADMIN_CREDIT"
                                        ? "Operator Load"
                                        : `Raw Iron (${ironPrice}g)`}
                                    </span>
                                  </div>
                                  {isAdjustment ? (
                                    <div className="mt-1.5 p-2 rounded-[4px] bg-floor border border-rule text-[12px] text-paper leading-relaxed tabular">
                                      {tx.recipeNote}
                                    </div>
                                  ) : (
                                    <div className="text-ash text-[12px] mt-0.5">
                                      {tx.recipeNote}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                            <div className="text-[12px] text-ash mt-1">
                              {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>

                        <div className="text-right tabular shrink-0">
                          <div
                            className={`font-bold text-[13px] ${
                              isDeposit ? "text-bullion" : "text-bullion"
                            }`}
                          >
                            {isDeposit ? "+" : "-"}{tx.amount.toLocaleString()} gold
                          </div>
                          <span className={`text-[12px] ${tx.status === "COMPLETED" ? "text-bullion" : "text-bullion"}`}>
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

      </div>
    </div>
  );
}
