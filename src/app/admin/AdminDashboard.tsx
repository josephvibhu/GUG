"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import { usePoll } from "@/hooks/usePoll";
import Link from "next/link";
import { 
  Shield, 
  Coins, 
  CheckCircle2, 
  XCircle, 
  UserCheck, 
  Settings, 
  Copy, 
  Check, 
  RefreshCw,
  Terminal,
  ArrowRight,
  Percent,
  AlertCircle,
  Clock,
  Timer,
  Building2,
  Zap,
  ExternalLink,
  Award,
  Calendar,
  Flame,
  Landmark,
  X,
  Search,
  Wallet,
  TrendingUp,
  PieChart,
  Users,
  Sliders,
  DollarSign
} from "lucide-react";

interface CitizenHolding {
  companyId: string;
  ticker: string;
  companyName: string;
  shares: number;
  lockedShares: number;
  totalShares: number;
  currentPrice: number;
  holdingValue: number;
  avgBuyPrice: number;
}

interface Citizen {
  id: string;
  username: string;
  display_name: string;
  parlamentum_name: string;
  cash_balance: number;
  locked_cash: number;
  portfolio_value?: number;
  total_net_worth?: number;
  holdings?: CitizenHolding[];
  is_admin: number;
  is_frozen?: number;
  created_at: string;
}

interface PendingDeposit {
  id: string;
  user_id: string;
  username: string;
  type?: string;
  amount: number;
  iron_units: number;
  parlamentum_name: string;
  method: string;
  recipe_note: string;
  created_at: string;
}

export default function AdminDashboard({ initialUser }: { initialUser?: any }) {
  const [loading, setLoading] = useState(!initialUser);
  const [isAdmin, setIsAdmin] = useState(Boolean(initialUser?.isAdmin));
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<PendingDeposit[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  
  // Settings
  const [taxRate, setTaxRate] = useState<number>(10);
  const [houseName, setHouseName] = useState<string>("JosephArora");
  const [autoApprove, setAutoApprove] = useState<boolean>(true);
  const [apiKey, setApiKey] = useState<string>("");
  const [tradeFee, setTradeFee] = useState<number>(0.5);
  const [listingFee, setListingFee] = useState<number>(200);

  // Market Trading Hours (UTC)
  const [openTime, setOpenTime] = useState<string>("15:30");
  const [closeTime, setCloseTime] = useState<string>("16:30");
  const [scheduleOverride, setScheduleOverride] = useState<"auto" | "force_open" | "force_closed">("auto");
  const [marketSchedule, setMarketSchedule] = useState<any>(null);

  // Pending IPO Applications
  const [ipoApplications, setIpoApplications] = useState<any[]>([]);
  const [negotiatingApp, setNegotiatingApp] = useState<{ [id: string]: { price: string; shares: string; floatPercent: string; notes: string } }>({});

  // Manual loader form
  const [targetCitizen, setTargetCitizen] = useState<string>("");
  const [creditAmount, setCreditAmount] = useState<string>("500");
  const [creditReason, setCreditReason] = useState<string>("Verified Parlamentum Raw Iron sale");

  // 50% Profit Dividend & Friday UTC 00:00 Engine
  const [earningsReports, setEarningsReports] = useState<any[]>([]);
  const [nextFriday, setNextFriday] = useState<string>("");
  const [divCompanyId, setDivCompanyId] = useState<string>("");
  const [divGrossRev, setDivGrossRev] = useState<string>("");
  const [divExpenses, setDivExpenses] = useState<string>("");
  const [divNetProfit, setDivNetProfit] = useState<string>("1000");
  const [divPeriod, setDivPeriod] = useState<string>("Weekly Audit Cycle");
  const [divNotes, setDivNotes] = useState<string>("Audited weekly trading and enterprise revenue.");
  const [divImmediate, setDivImmediate] = useState<boolean>(false);
  const [divSubmitting, setDivSubmitting] = useState<boolean>(false);
  const [processScheduledLoading, setProcessScheduledLoading] = useState<boolean>(false);

  // Citizen Wealth Inspector
  const [citizenSearch, setCitizenSearch] = useState<string>("");
  const [citizenFilter, setCitizenFilter] = useState<"ALL" | "WEALTHY" | "ADMIN">("ALL");
  const [adjustingCitizen, setAdjustingCitizen] = useState<Citizen | null>(null);
  const [adjustBalanceValue, setAdjustBalanceValue] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("Operator purse adjustment");
  const [adjustLoading, setAdjustLoading] = useState<boolean>(false);

  // Parlamentum In-Game Trade Ledger Sync (/trade/ledger)
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [tradeInsights, setTradeInsights] = useState<any | null>(null);
  const [ledgerCreditingId, setLedgerCreditingId] = useState<string | null>(null);
  const [manualCreditUser, setManualCreditUser] = useState<{ [id: string]: string }>({});
  const [financialSummary, setFinancialSummary] = useState<any | null>(null);
  
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchAdminData = async () => {
    try {
      const res = await fetch(`/api/admin?_t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setIsAdmin(true);
        setCitizens(data.citizens || []);
        setPendingDeposits(data.pendingDeposits || []);
        setIpoApplications(data.ipoApplications || []);
        setCompanies(data.companies || []);
        if (data.earningsReports) setEarningsReports(data.earningsReports);
        if (data.nextFriday) setNextFriday(data.nextFriday);
        if (data.ledgerEntries) setLedgerEntries(data.ledgerEntries);
        if (data.tradeInsights) setTradeInsights(data.tradeInsights);
        if (data.financialSummary) setFinancialSummary(data.financialSummary);
        if (data.companies && data.companies.length > 0 && !divCompanyId) {
          setDivCompanyId(data.companies[0].id);
        }
        if (data.settings) {
          setTaxRate(data.settings.taxRate);
          setHouseName(data.settings.houseName);
          setApiKey(data.settings.apiKey);
          setAutoApprove(data.settings.autoApprove);
          if (data.settings.tradeFee !== undefined) setTradeFee(data.settings.tradeFee);
          if (data.settings.listingFee !== undefined) setListingFee(data.settings.listingFee);
        }
        if (data.marketSchedule) {
          setMarketSchedule(data.marketSchedule);
          setOpenTime(data.marketSchedule.openTimeStr || "15:30");
          setCloseTime(data.marketSchedule.closeTimeStr || "16:30");
          setScheduleOverride(data.marketSchedule.override || "auto");
        }
      } else {
        setIsAdmin(false);
      }
    } catch (e) {
      console.error(e);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const handleFreezeUser = async (userId: string, freeze: boolean) => {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: freeze ? "freeze_user" : "unfreeze_user", userId }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        fetchAdminData();
      } else {
        setFeedback({ type: "error", message: data.message });
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message });
    }
  };

  const handleSetCompanyStatus = async (companyId: string, status: "ACTIVE" | "HALTED" | "DEFAULTED") => {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_company_status", companyId, status }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        fetchAdminData();
      } else {
        setFeedback({ type: "error", message: data.message });
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message });
    }
  };

  const handleReportEarnings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!divCompanyId) {
      setFeedback({ type: "error", message: "Please select an enterprise to report earnings for." });
      return;
    }
    const profit = parseFloat(divNetProfit);
    if (isNaN(profit) || profit <= 0) {
      setFeedback({ type: "error", message: "Net profit must be greater than 0 gold." });
      return;
    }
    setDivSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report_earnings",
          companyId: divCompanyId,
          grossRevenue: divGrossRev ? parseFloat(divGrossRev) : undefined,
          operatingExpenses: divExpenses ? parseFloat(divExpenses) : undefined,
          netProfit: profit,
          periodTitle: divPeriod,
          notes: divNotes,
          distributeImmediately: divImmediate,
          scheduledFor: nextFriday,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        setDivNetProfit("1000");
        fetchAdminData();
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to submit earnings report." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Network error" });
    } finally {
      setDivSubmitting(false);
    }
  };

  const handleDistributeNow = async (reportId: string) => {
    if (!confirm("Are you sure you want to distribute this 50% profit dividend now? Shareholder purses will immediately receive gold credits.")) return;
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "distribute_dividend_now", reportId }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        fetchAdminData();
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to distribute dividend." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Network error" });
    }
  };

  const handleProcessScheduledDividends = async () => {
    setProcessScheduledLoading(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process_scheduled_dividends" }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        fetchAdminData();
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to sweep scheduled dividends." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Network error" });
    } finally {
      setProcessScheduledLoading(false);
    }
  };


  const handleCreditLedgerEntry = async (entryId: string, defaultUsername: string) => {
    let userToCredit = manualCreditUser[entryId] || defaultUsername;
    if (!userToCredit) {
      const promptName = prompt("Enter the citizen username to credit for this in-game fill:", defaultUsername || "");
      if (!promptName) return;
      userToCredit = promptName;
      setManualCreditUser((prev) => ({ ...prev, [entryId]: promptName }));
    }
    setLedgerCreditingId(entryId);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "credit_ledger_entry_manual",
          entryId,
          username: userToCredit,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        fetchAdminData();
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to credit citizen." });
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message });
    } finally {
      setLedgerCreditingId(null);
    }
  };

  // Every user, portfolio and ledger entry comes back on each load: every 15 s, paused in hidden tabs (was 6 s, always)
  usePoll(async () => {
    await fetchAdminData();
  }, 15000);

  const handleApproveDeposit = async (txId: string) => {
    // Optimistically remove immediately so the card never lingers or flickers
    setPendingDeposits((prev) => prev.filter((p) => p.id !== txId));
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", txId }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        fetchAdminData();
      } else {
        setFeedback({ type: "error", message: data.message });
        fetchAdminData();
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message });
      fetchAdminData();
    }
  };

  const handleRejectTransaction = async (txId: string) => {
    // Optimistically remove immediately
    setPendingDeposits((prev) => prev.filter((p) => p.id !== txId));
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", txId }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        fetchAdminData();
      } else {
        setFeedback({ type: "error", message: data.message });
        fetchAdminData();
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message });
      fetchAdminData();
    }
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingCitizen) return;
    const newBal = parseFloat(adjustBalanceValue);
    if (isNaN(newBal) || newBal < 0) {
      setFeedback({ type: "error", message: "Please enter a valid positive gold balance." });
      return;
    }
    setAdjustLoading(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust_user_balance",
          userId: adjustingCitizen.id,
          newBalance: newBal,
          reason: adjustReason.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        setCitizens((prev) => prev.map((c) => c.id === adjustingCitizen.id ? { 
          ...c, 
          cash_balance: newBal,
          total_net_worth: newBal + (c.locked_cash || 0) + (c.portfolio_value || 0)
        } : c));
        setAdjustingCitizen(null);
        fetchAdminData();
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to adjust citizen purse balance." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Network error" });
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleManualCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const amt = parseFloat(creditAmount);
    if (!targetCitizen.trim() || isNaN(amt) || amt <= 0) {
      setFeedback({ type: "error", message: "Enter a valid citizen name and gold amount." });
      return;
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manual_credit",
          parlamentumName: targetCitizen.trim(),
          goldAmount: amt,
          reason: creditReason.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        setTargetCitizen("");
        fetchAdminData();
      } else {
        setFeedback({ type: "error", message: data.message });
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_settings",
          taxRate,
          houseName,
          autoApprove,
          apiKey,
          tradeFee: Number(tradeFee),
          listingFee: Number(listingFee),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
      } else {
        setFeedback({ type: "error", message: data.message });
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message });
    }
  };

  const handleApproveIPO = async (appId: string) => {
    // Optimistically remove immediately from pending IPO queue so it vanishes instantly
    setIpoApplications((prev) => prev.filter((a) => a.id !== appId));
    setFeedback(null);
    const form = negotiatingApp[appId] || {};
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_ipo",
          appId,
          negotiatedPrice: form.price ? parseFloat(form.price) : undefined,
          negotiatedShares: form.shares ? parseInt(form.shares, 10) : undefined,
          negotiatedFloatPercent: form.floatPercent ? parseFloat(form.floatPercent) : undefined,
          operatorNotes: form.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        fetchAdminData();
      } else {
        setFeedback({ type: "error", message: data.message });
        fetchAdminData();
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message });
      fetchAdminData();
    }
  };

  const handleRejectIPO = async (appId: string) => {
    // Optimistically remove immediately from pending IPO queue
    setIpoApplications((prev) => prev.filter((a) => a.id !== appId));
    setFeedback(null);
    const form = negotiatingApp[appId] || {};
    const reason = form.notes || "IPO charter terms declined by exchange operator";
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_ipo",
          appId,
          reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        fetchAdminData();
      } else {
        setFeedback({ type: "error", message: data.message });
        fetchAdminData();
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message });
      fetchAdminData();
    }
  };

  const handleSaveSchedule = async (newOverride?: "auto" | "force_open" | "force_closed") => {
    setFeedback(null);
    const targetOverride = newOverride || scheduleOverride;
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_schedule",
          openTime,
          closeTime,
          override: targetOverride,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        setScheduleOverride(targetOverride);
        if (data.schedule) {
          setMarketSchedule(data.schedule);
        }
      } else {
        setFeedback({ type: "error", message: data.message });
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center font-mono text-xs text-amber-400">
          Verifying operator credentials...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center max-w-md mx-auto">
          <Shield className="w-12 h-12 text-rose-500 mb-3" />
          <h2 className="text-xl font-bold">Operator Authorization Required</h2>
          <p className="text-xs text-zinc-400 mt-2 mb-6">
            This dashboard is reserved for the exchange operator. Log in with an account registered with the operator access code.
          </p>
          <Link
            href="/login"
            className="px-5 py-2.5 bg-amber-500 text-black font-bold rounded-xl text-xs hover:bg-amber-400 transition"
          >
            Log in as Operator
          </Link>
        </div>
      </div>
    );
  }

  const curlExample = `curl -X POST http://localhost:3000/api/admin \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "webhook_credit",
    "apiKey": "${apiKey}",
    "buyerName": "Trader_Vance",
    "ironUnits": 100,
    "goldAmount": 500
  }'`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <Navbar onUserRefresh={fetchAdminData} />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6 flex-1">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏛️</span>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Operator Control Panel
              </h1>
              <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">
                PARLAMENTUM TREASURY
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Verify Parlamentum Raw Iron sales, credit citizen purses, negate game taxes, and configure webhooks.
            </p>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-xl flex items-center gap-2 text-xs border ${
              feedback.type === "success"
                ? "bg-emerald-950/60 border-emerald-600/40 text-emerald-300"
                : "bg-rose-950/60 border-rose-600/40 text-rose-300"
            }`}
          >
            {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Operator Financial Ledger & Vault Profits */}
        {financialSummary && (
          <div className="bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-amber-950/20 border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-extrabold text-white text-lg tracking-tight">
                      Operator Vault & Exchange Profit Ledger
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      LIVE AUDIT
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Real-time balances of operator purse, platform treasury revenue, and total gold in custody.
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-sans text-zinc-400 uppercase tracking-wider block">
                  Total Platform Net Profit
                </span>
                <span className="font-mono text-xl sm:text-2xl font-black text-emerald-400">
                  +{Number(financialSummary.totalPlatformProfit || 0).toLocaleString()} gold
                </span>
              </div>
            </div>

            {/* Key Metric Pillars */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 font-mono">
              {/* Operator Personal Purse */}
              <div className="p-4 bg-zinc-950/90 border border-amber-500/30 rounded-xl flex flex-col justify-between gap-1 shadow-inner">
                <div className="flex items-center justify-between text-[11px] font-sans text-amber-300 font-semibold">
                  <span>Your Operator Purse</span>
                  <Wallet className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">
                  {Number(financialSummary.operatorCash || 0).toLocaleString()} <span className="text-xs text-amber-300/80 font-normal">gold</span>
                </div>
                <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between pt-1 border-t border-zinc-800/60">
                  <span>In Open Orders:</span>
                  <span className="text-zinc-300 font-mono">{Number(financialSummary.operatorLocked || 0).toLocaleString()} gold</span>
                </div>
              </div>

              {/* Exchange Treasury Vault */}
              <div className="p-4 bg-zinc-950/90 border border-zinc-800 rounded-xl flex flex-col justify-between gap-1 shadow-inner">
                <div className="flex items-center justify-between text-[11px] font-sans text-zinc-300 font-semibold">
                  <span>Exchange Treasury</span>
                  <Landmark className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-cyan-300 mt-1">
                  {Number(financialSummary.treasuryBalance || 0).toLocaleString()} <span className="text-xs text-cyan-400/80 font-normal">gold</span>
                </div>
                <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between pt-1 border-t border-zinc-800/60">
                  <span>Vault Account:</span>
                  <span className="text-zinc-400 font-mono">usr_treasury</span>
                </div>
              </div>

              {/* Trade Fees Earned */}
              <div className="p-4 bg-zinc-950/90 border border-zinc-800 rounded-xl flex flex-col justify-between gap-1 shadow-inner">
                <div className="flex items-center justify-between text-[11px] font-sans text-zinc-300 font-semibold">
                  <span>Trading Fees (0.5%)</span>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
                  +{Number(financialSummary.totalTradeFees || 0).toLocaleString()} <span className="text-xs text-emerald-300/80 font-normal">gold</span>
                </div>
                <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between pt-1 border-t border-zinc-800/60">
                  <span>Vol: {Number(financialSummary.totalTradeVolume || 0).toLocaleString()}g</span>
                  <span className="text-zinc-300">{financialSummary.tradeCount || 0} trades</span>
                </div>
              </div>

              {/* Citizen Gold Liabilities */}
              <div className="p-4 bg-zinc-950/90 border border-zinc-800 rounded-xl flex flex-col justify-between gap-1 shadow-inner">
                <div className="flex items-center justify-between text-[11px] font-sans text-zinc-300 font-semibold">
                  <span>Total Citizen Gold</span>
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-purple-300 mt-1">
                  {Number(financialSummary.totalCitizenGold || 0).toLocaleString()} <span className="text-xs text-purple-300/80 font-normal">gold</span>
                </div>
                <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between pt-1 border-t border-zinc-800/60">
                  <span>Circulating Supply</span>
                  <span className="text-zinc-300">{financialSummary.citizenCount || 0} citizens</span>
                </div>
              </div>
            </div>

            {/* Inflow vs Outflow Ledger Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-zinc-400 font-sans block">Total Gold Deposited (Inflow)</span>
                  <span className="font-mono text-sm font-bold text-emerald-400">
                    +{Number(financialSummary.totalDepositedGold || 0).toLocaleString()} gold
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono bg-zinc-900 px-2 py-1 rounded border border-rule">
                  {Number(financialSummary.totalIronUnitsDeposited || 0).toLocaleString()} Raw Iron
                </span>
              </div>

              <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-zinc-400 font-sans block">Total Gold Withdrawn (Outflow)</span>
                  <span className="font-mono text-sm font-bold text-rose-400">
                    -{Number(financialSummary.totalWithdrawnGold || 0).toLocaleString()} gold
                  </span>
                </div>
                {Number(financialSummary.pendingWithdrawalsGold || 0) > 0 && (
                  <span className="text-[10px] text-amber-300 font-mono bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">
                    {financialSummary.pendingWithdrawalsGold}g pending
                  </span>
                )}
              </div>

              <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-zinc-400 font-sans block">Net Gold Held Under Custody</span>
                  <span className="font-mono text-sm font-bold text-zinc-100">
                    {Number(financialSummary.netGoldInCustody || 0).toLocaleString()} gold
                  </span>
                </div>
                <span className="text-[10px] text-bullion font-mono bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                  IPO Fees: +{Number(financialSummary.totalIpoFees || financialSummary.totalListingFees || 0).toLocaleString()}g
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Section 0: Parlamentum In-Game Trade Ledger & Audit Feed (/trade/ledger) */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">📜</span>
                <h2 className="font-bold text-white text-base">
                  Parlamentum In-Game Trade Ledger Feed
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  LIVE SYNC ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Mirrored real-time transactions from{" "}
                <a
                  href="https://parlamentum.org/trade/ledger"
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-400 hover:underline font-mono inline-flex items-center gap-1"
                >
                  parlamentum.org/trade/ledger <ExternalLink className="w-3 h-3" />
                </a>
                . Citizen buyers in the <code className="text-zinc-300">WITH</code> column are automatically identified and credited!
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`/api/admin/userscript?key=${apiKey}`}
                target="_blank"
                className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs transition flex items-center gap-1.5"
                title="Install / Update Tampermonkey script v2.1"
              >
                <Zap className="w-3.5 h-3.5" />
                Userscript v2.1
              </a>
              <a
                href="https://parlamentum.org/trade/ledger"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs transition flex items-center gap-1.5"
              >
                Open Ledger <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* High-level Insights from Image 1 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-xl">
              <span className="text-[10px] uppercase font-sans text-zinc-400 block">Total Fills</span>
              <span className="text-xl font-bold text-white">
                {tradeInsights?.totalFills || ledgerEntries.length}
              </span>
              <span className="text-[10px] text-zinc-500 block font-sans">on both books</span>
            </div>
            <div className="p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-xl">
              <span className="text-[10px] uppercase font-sans text-zinc-400 block">Bought</span>
              <span className="text-xl font-bold text-emerald-400">
                {tradeInsights?.boughtFills || ledgerEntries.filter((e) => e.side === "BOUGHT").length}
              </span>
              <span className="text-[10px] text-zinc-500 block font-sans">fills executed</span>
            </div>
            <div className="p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-xl">
              <span className="text-[10px] uppercase font-sans text-zinc-400 block">Sold</span>
              <span className="text-xl font-bold text-cyan-400">
                {tradeInsights?.soldFills || ledgerEntries.filter((e) => e.side === "SOLD").length}
              </span>
              <span className="text-[10px] text-zinc-500 block font-sans">fills executed</span>
            </div>
            <div className="p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-xl">
              <span className="text-[10px] uppercase font-sans text-zinc-400 block">Items Traded</span>
              <span className="text-xl font-bold text-amber-400">
                {tradeInsights?.itemsCount || 11}
              </span>
              <span className="text-[10px] text-zinc-500 block font-sans">different goods</span>
            </div>
          </div>

          {/* Item Breakdown Summary if available */}
          {tradeInsights?.itemsBreakdown && tradeInsights.itemsBreakdown.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              {tradeInsights.itemsBreakdown.map((b: any, idx: number) => (
                <div
                  key={idx}
                  className="shrink-0 p-2.5 bg-zinc-950/60 border border-zinc-800 rounded-lg flex items-center gap-2 font-mono text-[11px]"
                >
                  <span className="font-sans font-bold text-zinc-200">{b.item}</span>
                  <span className="text-zinc-500">·</span>
                  <span className="text-zinc-400">{b.sold} sold</span>
                  <span
                    className={`font-bold ${
                      b.net >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {b.net >= 0 ? "+" : ""}{b.net.toLocaleString()} {b.currency}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* In-Game Transaction Ledger Table matching Image 2 */}
          <div className="overflow-x-auto border border-zinc-800/80 rounded-xl bg-zinc-950/60 max-h-[380px] overflow-y-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-400 font-sans">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Side</th>
                  <th className="py-2.5 px-3">Item</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Price</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-right">Tax</th>
                  <th className="py-2.5 px-3">With Counterparty</th>
                  <th className="py-2.5 px-3">Exchange Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-[11px]">
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-zinc-500 font-sans">
                      No ledger transactions synced yet. Open Parlamentum in your browser with userscript v2.0 to auto-populate.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((row) => {
                    const isSold = row.side === "SOLD";
                    const isCredited = row.status === "AUTO_CREDITED" || row.status === "MATCHED_PENDING";
                    const isRawIron = row.itemName.toLowerCase().includes("raw iron");
                    return (
                      <tr key={row.id} className="hover:bg-zinc-800/30 transition">
                        <td className="py-2.5 px-3 text-zinc-400 whitespace-nowrap">
                          {row.tradeDate}
                        </td>
                        <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                          {isSold ? (
                            <span className="text-cyan-400 flex items-center gap-1 font-sans text-[10px]">
                              ↗ SOLD
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1 font-sans text-[10px]">
                              ↙ BOUGHT
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-zinc-200 whitespace-nowrap">
                          {row.itemName}
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-300">
                          {row.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-400">
                          {row.priceStr || `${row.totalAmount / (row.quantity || 1)} ${row.currency}`}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-white">
                          {row.totalAmount.toFixed(2)} {row.currency}
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-500">
                          {row.taxAmount ? `${row.taxAmount.toFixed(2)} ${row.currency}` : "—"}
                        </td>
                        <td className="py-2.5 px-3 font-sans font-bold text-zinc-300 whitespace-nowrap">
                          {row.withUser ? (
                            <span className="text-amber-300">@{row.withUser}</span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {isCredited ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-sans">
                              ✅ CREDITED
                            </span>
                          ) : row.status === "UNREGISTERED_CITIZEN" ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 font-sans">
                              ⚠️ UNREGISTERED
                            </span>
                          ) : isRawIron && isSold ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 font-sans">
                              RAW IRON SALE
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-500 font-sans">
                              MARKET FILL
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {!isCredited && isSold && (
                            <button
                              type="button"
                              onClick={() => handleCreditLedgerEntry(row.id, row.withUser || "")}
                              disabled={ledgerCreditingId === row.id}
                              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-sans font-bold transition cursor-pointer disabled:opacity-50"
                              title="Credit gold to citizen purse"
                            >
                              {ledgerCreditingId === row.id ? "Crediting..." : "Credit Purse"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 1: Live Pending Deposit Queue & Manual Credit Tool */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Manual Purse Loader (5 cols) */}
          <div className="lg:col-span-5 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="font-bold text-white text-sm flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400" />
                Load Citizen Purse from Game Sale
              </h2>
              <span className="text-[10px] text-zinc-400 font-mono">1 Raw Iron = 5g</span>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              When a player buys Raw Iron from your shop in Parlamentum, enter their character name and the gold amount below to load their exchange purse.
            </p>

            <form onSubmit={handleManualCredit} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Citizen Parlamentum Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Trader_Vance"
                  value={targetCitizen}
                  onChange={(e) => setTargetCitizen(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold text-zinc-300 mb-1">
                  <span>Gold Amount to Credit</span>
                  <span className="font-mono text-zinc-400">
                    = {Math.ceil(parseFloat(creditAmount || "0") / 5)} Raw Iron
                  </span>
                </div>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 font-bold focus:outline-none focus:border-amber-400"
                />

                {/* Quick Raw Iron units presets */}
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {[
                    { iron: 20, gold: 100 },
                    { iron: 100, gold: 500 },
                    { iron: 200, gold: 1000 },
                    { iron: 500, gold: 2500 },
                  ].map((preset) => (
                    <button
                      key={preset.iron}
                      type="button"
                      onClick={() => setCreditAmount(preset.gold.toString())}
                      className="py-1 text-[10px] font-mono bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition cursor-pointer"
                    >
                      {preset.iron} Fe ({preset.gold}g)
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Verification Audit Note
                </label>
                <input
                  type="text"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs tracking-wide transition shadow-lg shadow-emerald-500/20 cursor-pointer mt-1"
              >
                Credit {creditAmount} Gold to {targetCitizen || "Citizen"}
              </button>
            </form>
          </div>

          {/* Pending Deposit Announcements (7 cols) */}
          <div className="lg:col-span-7 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
              <h2 className="font-bold text-white text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-400" />
                Pending In-Game Deposit Announcements
              </h2>
              <span className="text-[11px] font-mono text-zinc-400">
                {pendingDeposits.length} awaiting review
              </span>
            </div>

            {pendingDeposits.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 text-xs flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-zinc-600" />
                <span>All citizen deposits have been cleared and verified!</span>
                <span className="text-[10px] text-zinc-400">
                  {autoApprove ? "(Auto-approve is currently enabled)" : "(Awaiting player announcements)"}
                </span>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto max-h-[340px] pr-1 scrollbar-thin">
                {pendingDeposits.map((tx) => {
                  const isWithdrawal = tx.type === "WITHDRAWAL";
                  return (
                    <div
                      key={tx.id}
                      className={`p-3 bg-zinc-950 border rounded-xl flex items-center justify-between gap-3 text-xs ${
                        isWithdrawal ? "border-amber-500/30 bg-amber-950/10" : "border-zinc-800"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          {isWithdrawal ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                              🔻 WITHDRAWAL PAYOUT
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
                              🟢 DEPOSIT
                            </span>
                          )}
                          <span>@{tx.parlamentum_name}</span>
                          <span className={`font-mono font-bold ${isWithdrawal ? "text-amber-400" : "text-emerald-400"}`}>
                            {isWithdrawal ? "-" : "+"}{tx.amount.toLocaleString()} gold ({tx.iron_units} Raw Iron)
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-300 mt-1 line-clamp-2">
                          {tx.recipe_note}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-1 font-mono">
                          {new Date(tx.created_at).toLocaleTimeString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isWithdrawal ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRejectTransaction(tx.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950 text-rose-300 text-xs font-semibold transition cursor-pointer"
                              title="Cancel withdrawal and refund gold to purse"
                            >
                              Refund
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveDeposit(tx.id)}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition cursor-pointer shadow-lg shadow-amber-500/20"
                              title="Confirm you purchased their Raw Iron in Parlamentum"
                            >
                              Confirm Bought
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRejectTransaction(tx.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950 text-rose-300 text-xs font-semibold transition cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveDeposit(tx.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20"
                            >
                              Approve & Credit
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Automated Bot / Webhook Integration Guide */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              Automated Game Sale Webhook (Zero Manual Work)
            </h3>
            <span className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded font-mono">
              REST Webhook
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            If you run a bot, Discord logger, or script monitoring your in-game market sales in Parlamentum, 
            you can automatically credit buyers by sending an HTTP POST request to this webhook:
          </p>

          <div className="relative bg-zinc-950 border border-zinc-800 rounded-xl p-3 font-mono text-[11px] text-zinc-300 overflow-x-auto">
            <button
              onClick={() => copyToClipboard(curlExample)}
              className="absolute right-3 top-3 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[10px] flex items-center gap-1 cursor-pointer transition"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy cURL"}
            </button>
            <pre className="pr-16">{curlExample}</pre>
          </div>
        </div>

        {/* Section 2.5: Market Trading Hours & Floor Controls (UTC) */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-3 gap-2">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                Parlamentum Bourse Trading Hours (UTC)
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Current week trading session: <strong>15:30 – 16:30 UTC</strong> (3:30 PM – 4:30 PM UTC). Order placement is blocked when the floor is closed.
              </p>
            </div>

            {marketSchedule && (
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl font-mono text-xs">
                <span className={`w-2.5 h-2.5 rounded-full ${marketSchedule.isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                <span className={marketSchedule.isOpen ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {marketSchedule.isOpen ? "FLOOR OPEN" : "FLOOR CLOSED"}
                </span>
                <span className="text-zinc-400 text-[11px]">
                  ({marketSchedule.currentUTC || marketSchedule.currentIST})
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold text-zinc-300 block mb-1">
                Floor Opens (UTC)
              </label>
              <input
                type="text"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                placeholder="15:30 (3:30 PM UTC)"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 font-mono text-white text-sm focus:outline-none focus:border-amber-400"
              />
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Format: 24h HH:MM (e.g. 15:30 for 3:30 PM UTC)
              </span>
            </div>

            <div>
              <label className="font-semibold text-zinc-300 block mb-1">
                Floor Closes (UTC)
              </label>
              <input
                type="text"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                placeholder="16:30 (4:30 PM UTC)"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 font-mono text-white text-sm focus:outline-none focus:border-amber-400"
              />
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Format: 24h HH:MM (e.g. 16:30 for 1-hour window, 17:30 for 2-hour)
              </span>
            </div>

            <div>
              <label className="font-semibold text-zinc-300 block mb-1">
                Session Presets (UTC)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpenTime("15:30");
                    setCloseTime("16:30");
                  }}
                  className="flex-1 py-2 px-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-mono text-[11px] text-amber-300 text-center transition cursor-pointer"
                >
                  1h (15:30-16:30 UTC)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenTime("15:30");
                    setCloseTime("17:30");
                  }}
                  className="flex-1 py-2 px-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-mono text-[11px] text-zinc-300 text-center transition cursor-pointer"
                >
                  2h (15:30-17:30 UTC)
                </button>
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Click preset then click Save Schedule below.
              </span>
            </div>
          </div>

          {/* Quick Override Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 font-semibold">Floor Mode:</span>
              <button
                type="button"
                onClick={() => handleSaveSchedule("auto")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                  scheduleOverride === "auto"
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                ⏱️ Follow UTC Schedule
              </button>
              <button
                type="button"
                onClick={() => handleSaveSchedule("force_open")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                  scheduleOverride === "force_open"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                🟢 Force Open Floor
              </button>
              <button
                type="button"
                onClick={() => handleSaveSchedule("force_closed")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                  scheduleOverride === "force_closed"
                    ? "bg-rose-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                🔴 Force Close Floor
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleSaveSchedule()}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              Save Schedule ({openTime} – {closeTime} UTC)
            </button>
          </div>
        </div>

        {/* Section 2.8: IPO Applications & Price Negotiation Queue */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-400" />
                IPO Charter Applications & Price Negotiation Queue
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Companies cannot list independently. Review founder applications, negotiate IPO prices, and approve them onto the bourse floor.
              </p>
            </div>
            <span className="text-[11px] font-mono text-purple-400 font-bold bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 rounded-lg">
              {ipoApplications.length} Pending Charters
            </span>
          </div>

          {ipoApplications.length === 0 ? (
            <div className="py-10 text-center text-zinc-400 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-zinc-600" />
              <span>No pending IPO applications. All corporate filings are processed!</span>
              <span className="text-[10px] text-zinc-500">
                Founders submit charter requests on the <Link href="/ipo" className="text-amber-400 underline">Launch IPO</Link> page.
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              {ipoApplications.map((app) => {
                const proposedShares = Number(app.proposedTotalShares);
                const proposedPrice = Number(app.proposedIpoPrice);
                const proposedFounderPct = Number(app.proposedFounderRetainPercent);
                const proposedFloat = parseFloat((100 - proposedFounderPct).toFixed(2));
                const proposedFloatShares = Math.max(1, Math.round(proposedShares * (proposedFloat / 100)));
                const proposedFounderShares = proposedShares - proposedFloatShares;
                const proposedFloatCap = proposedFloatShares * proposedPrice;
                const proposedTotalValuation = proposedShares * proposedPrice;

                const formState = negotiatingApp[app.id] || {
                  price: String(app.proposedIpoPrice),
                  shares: String(app.proposedTotalShares),
                  floatPercent: String(proposedFloat),
                  notes: "",
                };

                const updateForm = (key: string, val: string) => {
                  setNegotiatingApp(prev => ({
                    ...prev,
                    [app.id]: {
                      price: key === "price" ? val : (formState.price ?? String(app.proposedIpoPrice)),
                      shares: key === "shares" ? val : (formState.shares ?? String(app.proposedTotalShares)),
                      floatPercent: key === "floatPercent" ? val : (formState.floatPercent ?? String(proposedFloat)),
                      notes: key === "notes" ? val : (formState.notes ?? ""),
                    }
                  }));
                };

                // Live calculated values based on operator's inputs
                const parsedShares = parseInt(formState.shares, 10) || proposedShares;
                const parsedPrice = parseFloat(formState.price) || proposedPrice;
                const parsedFloat = Math.min(99.9, Math.max(0.1, parseFloat(formState.floatPercent) || proposedFloat));
                const parsedFounderPct = parseFloat((100 - parsedFloat).toFixed(2));
                const negotiatedFloatShares = Math.max(1, Math.round(parsedShares * (parsedFloat / 100)));
                const negotiatedFounderShares = parsedShares - negotiatedFloatShares;
                const negotiatedFloatCap = negotiatedFloatShares * parsedPrice;
                const negotiatedTotalValuation = parsedShares * parsedPrice;

                return (
                  <div key={app.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4 text-xs">
                    {/* Header: Company info and Applicant */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg">{app.logoUrl}</span>
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-2">
                            <span>{app.name}</span>
                            <span className="font-mono text-amber-400 font-bold">(${app.ticker})</span>
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5 flex flex-wrap items-center gap-2">
                            <span>Sector: <strong className="text-zinc-300">{app.sector}</strong></span>
                            <span>·</span>
                            <span>Applicant: <strong className="text-purple-300">@{app.parlamentumName}</strong></span>
                            <span>·</span>
                            <span className="px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 font-mono font-bold text-[10px]">
                              💬 Discord: {app.discordId ? `@${app.discordId}` : "None"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono text-[11px] text-zinc-400">
                        <div>Submitted: {new Date(app.createdAt).toLocaleDateString()} {new Date(app.createdAt).toLocaleTimeString()}</div>
                      </div>
                    </div>

                    {/* Rich Metrics & Backing Assets Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 bg-zinc-900/80 rounded-lg border border-zinc-800 text-[11px]">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold block">Model & Classification</span>
                        <span className="text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                          {app.businessType === "FACTORY" ? "🏭 Industrial / Factory" : app.businessType === "PRESS" ? "📰 Newspaper & Press" : "⚜️ Special Enterprise"}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold block">Est. Weekly Revenue</span>
                        <span className="font-mono text-emerald-400 font-bold text-xs mt-0.5 block">
                          {app.weeklyRevenue ? `${Number(app.weeklyRevenue).toLocaleString()} gold / wk` : "0 gold"}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold block">Specific Production / Metrics</span>
                        <span className="font-mono text-zinc-300 text-xs mt-0.5 block truncate">
                          {app.businessType === "FACTORY" 
                            ? `Lvl ${app.factoryLevel || 1} · ${app.workersCount || 0} workers · ${app.productionOutput || "Standard"}`
                            : app.businessType === "PRESS"
                            ? `${app.pressViewers || "General"} readers (${app.pressFrequency || "Weekly"})`
                            : (app.specialNotes || "Special Lore")}
                        </span>
                      </div>
                    </div>

                    {/* Business Lore & In-Game Backing */}
                    <div className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800 text-[11px] leading-relaxed text-zinc-300">
                      <strong className="text-amber-400 font-sans block mb-1">Business Lore & Backing Assets:</strong>
                      {app.description}
                    </div>

                    {/* Applicant's Proposed Equity & Valuation Breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-amber-300 block">
                          🪙 Public Float (% Putting Out)
                        </span>
                        <div className="font-mono text-base font-extrabold text-amber-400 mt-0.5">
                          {proposedFloat.toFixed(2)}%
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          {proposedFloatShares.toLocaleString()} shares to list
                        </div>
                      </div>

                      <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-purple-300 block">
                          🏛️ Founder Retained Stake
                        </span>
                        <div className="font-mono text-base font-extrabold text-purple-300 mt-0.5">
                          {proposedFounderPct.toFixed(2)}%
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          {proposedFounderShares.toLocaleString()} shares kept
                        </div>
                      </div>

                      <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-emerald-300 block">
                          💰 Float Capital Raised
                        </span>
                        <div className="font-mono text-base font-extrabold text-emerald-400 mt-0.5">
                          {proposedFloatCap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          at {proposedPrice.toFixed(2)}g / share
                        </div>
                      </div>

                      <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                          📊 Total Valuation
                        </span>
                        <div className="font-mono text-base font-extrabold text-white mt-0.5">
                          {proposedTotalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          {proposedShares.toLocaleString()} total shares
                        </div>
                      </div>
                    </div>

                    {/* Sovereign Negotiation & Float Adjuster */}
                    <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/80 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <span className="font-bold text-zinc-200 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                          ⚖️ Sovereign Negotiation & Micro-Float Adjuster
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          Supports micro-floats down to 0.10%
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Public Float % Input with Micro-Float capability down to 0.10% */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] uppercase font-bold text-amber-400">
                              Public Float % (Putting Out)
                            </label>
                            <span className="font-mono text-[10px] text-zinc-400">
                              Prop: {proposedFloat.toFixed(2)}%
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0.10"
                              max="99.90"
                              value={formState.floatPercent}
                              onChange={(e) => updateForm("floatPercent", e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-2.5 pr-8 py-1.5 font-mono text-amber-400 font-bold text-xs focus:outline-none focus:border-amber-400"
                            />
                            <Percent className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 top-2" />
                          </div>

                          {/* Quick Float Preset Pills including micro-float 0.10% */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {[
                              { label: "0.10%", val: "0.10", tip: "0.10% Micro-Float" },
                              { label: "1%", val: "1.00", tip: "1% Float" },
                              { label: "5%", val: "5.00", tip: "5% Float" },
                              { label: "10%", val: "10.00", tip: "10% Standard Float" },
                              { label: "25%", val: "25.00", tip: "25% Quarter Float" },
                              { label: "50%", val: "50.00", tip: "50% Half Float" },
                            ].map((pill) => (
                              <button
                                key={pill.val}
                                type="button"
                                onClick={() => updateForm("floatPercent", pill.val)}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition cursor-pointer border ${
                                  formState.floatPercent === pill.val
                                    ? "bg-amber-500 text-black font-bold border-amber-400"
                                    : "bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700"
                                }`}
                                title={pill.tip}
                              >
                                {pill.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Negotiated IPO Price */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] uppercase font-bold text-emerald-400">
                              IPO Price (Gold / Share)
                            </label>
                            <span className="font-mono text-[10px] text-zinc-400">
                              Prop: {app.proposedIpoPrice}g
                            </span>
                          </div>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={formState.price}
                            onChange={(e) => updateForm("price", e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 font-mono text-emerald-400 font-bold text-xs focus:outline-none focus:border-amber-400"
                          />
                          <span className="text-[10px] text-zinc-400 mt-1.5 block">
                            Valuation: {negotiatedTotalValuation.toLocaleString()}g
                          </span>
                        </div>

                        {/* Negotiated Total Shares */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] uppercase font-bold text-zinc-300">
                              Total Shares
                            </label>
                            <span className="font-mono text-[10px] text-zinc-400">
                              Prop: {app.proposedTotalShares.toLocaleString()}
                            </span>
                          </div>
                          <input
                            type="number"
                            step="1000"
                            min="1000"
                            value={formState.shares}
                            onChange={(e) => updateForm("shares", e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 font-mono text-white text-xs focus:outline-none focus:border-amber-400"
                          />
                          <span className="text-[10px] text-zinc-400 mt-1.5 block font-mono">
                            Founder retains {negotiatedFounderShares.toLocaleString()} sh.
                          </span>
                        </div>

                        {/* Listing Terms / Notes */}
                        <div>
                          <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                            Listing Terms / Note to Founder
                          </label>
                          <input
                            type="text"
                            value={formState.notes}
                            onChange={(e) => updateForm("notes", e.target.value)}
                            placeholder="e.g. Terms agreed via Discord"
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                          />
                          <span className="text-[10px] text-zinc-400 mt-1.5 block">
                            Visible on company floor dossier
                          </span>
                        </div>
                      </div>

                      {/* Live Listing Execution Breakdown */}
                      <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-zinc-400">Opening Bourse Float:</span>
                          <strong className="text-amber-400 font-mono">{negotiatedFloatShares.toLocaleString()} shares ({parsedFloat.toFixed(2)}%)</strong>
                          <span className="text-zinc-600">·</span>
                          <span className="text-zinc-400">Founder Retains:</span>
                          <strong className="text-purple-300 font-mono">{negotiatedFounderShares.toLocaleString()} shares ({parsedFounderPct.toFixed(2)}%)</strong>
                          <span className="text-zinc-600">·</span>
                          <span className="text-zinc-400">Float Capital Raised:</span>
                          <strong className="text-emerald-400 font-mono">{negotiatedFloatCap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gold</strong>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleRejectIPO(app.id)}
                        className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-rose-950 text-rose-400 border border-zinc-700 font-semibold text-xs transition cursor-pointer"
                      >
                        Reject Charter
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApproveIPO(app.id)}
                        className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Approve & Open ${app.ticker} Float ({parsedFloat.toFixed(2)}%) on Bourse</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: Realm Tax Negation & Operator Settings */}
        <form onSubmit={handleSaveSettings} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" />
              Realm Market Tax Negation & House Configuration
            </h3>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition cursor-pointer"
            >
              Save Settings
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
            <div>
              <label className="font-semibold text-zinc-300 block mb-1">
                Parlamentum Game Market Tax (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="40"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-3 pr-8 py-2 font-mono text-white text-sm focus:outline-none focus:border-amber-400"
                />
                <Percent className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-3" />
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Tax negated on withdrawals so players receive their exact net gold! Supports decimals down to 0.01%.
              </span>
            </div>

            <div>
              <label className="font-semibold text-zinc-300 block mb-1">
                Bourse Trade Brokerage Fee (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.01"
                  value={tradeFee}
                  onChange={(e) => setTradeFee(parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-3 pr-8 py-2 font-mono text-emerald-400 font-bold text-sm focus:outline-none focus:border-amber-400"
                />
                <Percent className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-3" />
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Standard House cut across share matches (e.g. 0.5% or 0.10%).
              </span>
            </div>

            <div>
              <label className="font-semibold text-zinc-300 block mb-1">
                Standard IPO Listing Fee (gold)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="50"
                  value={listingFee}
                  onChange={(e) => setListingFee(parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-3 pr-8 py-2 font-mono text-amber-300 font-bold text-sm focus:outline-none focus:border-amber-400"
                />
                <Coins className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-3" />
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Charter underwriting fee credited to Treasury.
              </span>
            </div>

            <div>
              <label className="font-semibold text-zinc-300 block mb-1">
                Operator House Name
              </label>
              <input
                type="text"
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 font-mono text-white text-sm focus:outline-none focus:border-amber-400"
              />
              <span className="text-[10px] text-zinc-400 mt-1 block">
                In-game character name where players buy Raw Iron from.
              </span>
            </div>

            <div>
              <label className="font-semibold text-zinc-300 block mb-1">
                Deposit Mode
              </label>
              <select
                value={autoApprove ? "true" : "false"}
                onChange={(e) => setAutoApprove(e.target.value === "true")}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="true">Instant (Auto-credit on announce)</option>
                <option value="false">Manual Review (Approve in queue)</option>
              </select>
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Control instant vs review-based deposit recognition.
              </span>
            </div>
          </div>
        </form>

        {/* Section 3.5: In-Game Deposit Auto-Verifier (Method 2 Userscript) */}
        <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-zinc-900/60 border border-emerald-500/30 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">
                  In-Game Deposit Auto-Verifier (Method 2 Userscript)
                </h3>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                  ZERO RISK & MULTI-TAB SAFE
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Automatically detects when someone buys your Raw Iron in Parlamentum and immediately approves their pending deposit in Grow UR Gold.
              </p>
            </div>

            <a
              href={`/api/admin/userscript?key=${apiKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition shadow-lg shadow-emerald-500/20 shrink-0"
            >
              <span>Install Userscript v2.1</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800">
              <span className="font-bold text-zinc-200 block mb-1">🛡️ Multi-Account Isolation</span>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                If you keep multiple accounts open in different tabs, the script checks the active player card and only activates on <span className="font-mono text-amber-300 font-bold">JosephArora</span>. Tabs for other characters (e.g. CardinalSanjay) remain completely dormant.
              </p>
            </div>

            <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800">
              <span className="font-bold text-zinc-200 block mb-1">🎯 Smart Queue Matcher</span>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Because Parlamentum market notifications are anonymous (e.g. <span className="text-zinc-300 italic">&ldquo;2× Raw Iron sold — 10 gold&rdquo;</span>), the backend instantly matches the sale to the oldest citizen pending deposit requesting that amount.
              </p>
            </div>

            <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800">
              <span className="font-bold text-zinc-200 block mb-1">🔑 Secret Webhook Key</span>
              <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">
                Embedded directly in the script for authenticated webhook callbacks:
              </p>
              <div className="flex items-center justify-between bg-zinc-900 px-2.5 py-1.5 rounded font-mono text-[11px] text-amber-300 border border-zinc-700">
                <span className="truncate">{apiKey || "not set"}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKey);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="ml-2 text-zinc-400 hover:text-white"
                  title="Copy Key"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Listed Companies & Ticker Controls (Method 5) */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                Listed Companies & Ticker Floor Controls (Method 5)
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Operator power over tickers: temporarily halt trading for price stabilization or flag defaulting/scam companies.
              </p>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              {companies.length} chartered
            </span>
          </div>

          {companies.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              0 companies currently listed on the exchange.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800 font-sans">
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Founder</th>
                    <th className="py-3 px-4 text-right">Last Price</th>
                    <th className="py-3 px-4 text-right">Shares Bought Back</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Operator Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {companies.map((cmp) => (
                    <tr key={cmp.id} className="hover:bg-zinc-800/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{cmp.logoUrl || "🏛️"}</span>
                          <div>
                            <Link href={`/trade/${cmp.ticker}`} className="text-white font-bold font-sans hover:text-amber-400 transition">
                              {cmp.name}
                            </Link>
                            <span className="font-mono text-amber-400 font-bold ml-1.5 text-[11px]">
                              ${cmp.ticker}
                            </span>
                            {cmp.weeklyRevenue ? (
                              <span className="text-[10px] text-emerald-400 font-mono ml-2 font-normal">
                                · ~{Number(cmp.weeklyRevenue).toLocaleString()}g/wk
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-300 font-sans text-xs">
                        {cmp.creatorName || cmp.creatorId}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white">
                        {cmp.currentPrice.toFixed(2)}g
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-400">
                        {cmp.sharesBoughtBack ? `${cmp.sharesBoughtBack.toLocaleString()} shares` : "0"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {cmp.status === "HALTED" ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            ⏸️ HALTED
                          </span>
                        ) : cmp.status === "DEFAULTED" ? (
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                            🚨 DEFAULTED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                            🟢 ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 font-sans">
                          {cmp.status === "HALTED" ? (
                            <button
                              onClick={() => handleSetCompanyStatus(cmp.id, "ACTIVE")}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold transition cursor-pointer"
                            >
                              Resume
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSetCompanyStatus(cmp.id, "HALTED")}
                              className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-black text-[10px] font-semibold transition cursor-pointer"
                            >
                              Halt
                            </button>
                          )}
                          {cmp.status !== "DEFAULTED" && (
                            <button
                              onClick={() => handleSetCompanyStatus(cmp.id, "DEFAULTED")}
                              className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-800 text-rose-300 border border-rose-700/50 text-[10px] font-semibold transition cursor-pointer"
                            >
                              Flag Scam
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 5: Corporate Earnings & Friday 50% Profit Dividend Desk */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">
                  Corporate Earnings & Friday 50% Profit Dividend Desk
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  WEEKLY UTC 00:00 PAYOUT
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Audit weekly net profits, declare 50% profit distributions, and automatically sweep dividend gold into shareholder purses every Friday at 00:00 UTC.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 text-right font-mono text-xs">
                <span className="text-[10px] text-zinc-400 block font-sans uppercase">Next Friday Payout</span>
                <span className="text-amber-400 font-bold">
                  {nextFriday ? new Date(nextFriday).toUTCString().slice(0, 22) : "Calculating..."}
                </span>
              </div>

              <button
                type="button"
                onClick={handleProcessScheduledDividends}
                disabled={processScheduledLoading}
                className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-4 h-4 text-amber-400" />
                {processScheduledLoading ? "Sweeping Dividends..." : "Force Friday Sweeper"}
              </button>
            </div>
          </div>

          {/* Form to report earnings */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleReportEarnings} className="lg:col-span-5 bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-4 flex flex-col gap-3 font-sans text-xs">
              <h4 className="font-bold text-zinc-200 text-sm flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                Declare Corporate Earnings & Dividend
              </h4>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Enterprise / Company
                </label>
                <select
                  value={divCompanyId}
                  onChange={(e) => setDivCompanyId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      ${c.ticker} — {c.name} ({Number(c.totalShares).toLocaleString()} shares)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Gross Revenue (gold)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={divGrossRev}
                    onChange={(e) => setDivGrossRev(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Expenses (gold)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 2000"
                    value={divExpenses}
                    onChange={(e) => setDivExpenses(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-semibold text-zinc-300">
                    Net Audited Profit (gold) *
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono font-bold">
                    50% Pool = {(parseFloat(divNetProfit || "0") * 0.5).toFixed(1)}g
                  </span>
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  placeholder="e.g. 3000"
                  value={divNetProfit}
                  onChange={(e) => setDivNetProfit(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-emerald-400 font-mono text-sm font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Audit Notes / Cycle Label
                </label>
                <input
                  type="text"
                  value={divNotes}
                  onChange={(e) => setDivNotes(e.target.value)}
                  placeholder="e.g. Iron trade surplus from Milan route"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-white font-sans text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="p-2.5 bg-zinc-900/90 rounded-lg border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-zinc-200 text-xs">Immediate Distribution?</div>
                  <div className="text-[10px] text-zinc-400">
                    If checked, pays out now instead of waiting for Friday 00:00 UTC
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={divImmediate}
                  onChange={(e) => setDivImmediate(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={divSubmitting || !divCompanyId}
                className="mt-1 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
              >
                {divSubmitting ? "Committing Report..." : divImmediate ? "Declare & Distribute 50% Profit Now" : "Schedule 50% Profit for Next Friday (00:00 UTC)"}
              </button>
            </form>

            {/* List of earnings reports */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-zinc-200 text-xs uppercase tracking-wider font-sans">
                  Earnings & Friday Dividend Audit Log ({earningsReports.length})
                </h4>
              </div>

              {earningsReports.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 font-mono text-xs border border-dashed border-zinc-800 rounded-xl">
                  No earnings reports logged yet. Submit the audit report on the left to schedule the upcoming Friday distribution.
                </div>
              ) : (
                <div className="overflow-x-auto border border-zinc-800/80 rounded-xl bg-zinc-950/60 max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="sticky top-0 bg-zinc-900">
                      <tr className="text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800 font-sans">
                        <th className="py-2.5 px-3">Enterprise</th>
                        <th className="py-2.5 px-3">Audited Profit</th>
                        <th className="py-2.5 px-3">50% Pool</th>
                        <th className="py-2.5 px-3">Per Share</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-[11px]">
                      {earningsReports.map((r) => {
                        const targetCmp = companies.find((c) => c.id === r.companyId);
                        const isPaid = r.status === "DISTRIBUTED";
                        return (
                          <tr key={r.id} className="hover:bg-zinc-800/30">
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-white font-sans">
                                ${targetCmp?.ticker || r.companyId}
                              </span>
                              <span className="block text-[10px] text-zinc-400 font-sans">
                                {new Date(r.scheduledFor || r.createdAt).toUTCString().slice(0, 16)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-zinc-200">
                              {Number(r.netProfit).toFixed(0)}g
                            </td>
                            <td className="py-2.5 px-3 font-bold text-amber-400">
                              {Number(r.dividendPool).toFixed(1)}g
                            </td>
                            <td className="py-2.5 px-3 text-emerald-400">
                              {Number(r.dividendPerShare).toFixed(4)}g
                            </td>
                            <td className="py-2.5 px-3">
                              {isPaid ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-sans">
                                  PAID OUT
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 font-sans animate-pulse">
                                  SCHEDULED
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {!isPaid && (
                                <button
                                  type="button"
                                  onClick={() => handleDistributeNow(r.id)}
                                  className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold font-sans transition cursor-pointer"
                                >
                                  Distribute Now
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 6: Citizen & Sovereign State Wealth Inspector */}
        {(() => {
          const totalPurseCash = citizens.reduce((sum, c) => sum + (Number(c.cash_balance) || 0), 0);
          const totalLockedCash = citizens.reduce((sum, c) => sum + (Number(c.locked_cash) || 0), 0);
          const totalPortfolioValue = citizens.reduce((sum, c) => sum + (Number(c.portfolio_value) || 0), 0);
          const totalNetWorth = citizens.reduce((sum, c) => sum + (Number(c.total_net_worth) || ((Number(c.cash_balance) || 0) + (Number(c.locked_cash) || 0))), 0);

          const filteredCitizens = citizens.filter((c) => {
            if (citizenFilter === "WEALTHY" && ((Number(c.cash_balance) || 0) <= 0 && (!c.portfolio_value || c.portfolio_value <= 0))) return false;
            if (citizenFilter === "ADMIN" && !c.is_admin) return false;

            if (citizenSearch.trim()) {
              const q = citizenSearch.toLowerCase().trim();
              const matchName = c.username.toLowerCase().includes(q);
              const matchDisplay = (c.display_name || "").toLowerCase().includes(q);
              const matchParlamentum = (c.parlamentum_name || "").toLowerCase().includes(q);
              const matchHoldings = (c.holdings || []).some((h) => 
                h.ticker.toLowerCase().includes(q) || h.companyName.toLowerCase().includes(q)
              );
              if (!matchName && !matchDisplay && !matchParlamentum && !matchHoldings) {
                return false;
              }
            }
            return true;
          });

          return (
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col gap-5 p-5">
              {/* Header and Title */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-amber-400" />
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      Citizen Wealth Inspector
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      LIVE PURSE & EQUITY BALANCES
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Real-time registry of all accounts on the exchange. Monitor circulating purse cash, capital locked in active buy orders, stock equity valuation, and adjust purse balances directly.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => fetchAdminData()}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                    Refresh Balances
                  </button>
                </div>
              </div>

              {/* Platform-Wide Wealth Aggregates */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-zinc-400">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>Registered Accounts</span>
                  </div>
                  <div className="font-mono text-lg font-black text-white mt-1">
                    {citizens.length}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    Individual Player Purses
                  </div>
                </div>

                <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-emerald-400">
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Purse Gold (Cash)</span>
                  </div>
                  <div className="font-mono text-lg font-black text-emerald-400 mt-1">
                    {totalPurseCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    Available in player purses
                  </div>
                </div>

                <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-amber-400">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Locked in Orders</span>
                  </div>
                  <div className="font-mono text-lg font-black text-amber-400 mt-1">
                    {totalLockedCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    Committed in active limit bids
                  </div>
                </div>

                <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-purple-400">
                    <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                    <span>Stock Holdings Value</span>
                  </div>
                  <div className="font-mono text-lg font-black text-purple-300 mt-1">
                    {totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    Market value of citizen shares
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl col-span-2 sm:col-span-1">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-amber-300">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    <span>Combined Net Worth</span>
                  </div>
                  <div className="font-mono text-lg font-black text-amber-400 mt-1">
                    {totalNetWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                    Purse + Locked + Stocks
                  </div>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={citizenSearch}
                    onChange={(e) => setCitizenSearch(e.target.value)}
                    placeholder="Search by username, display name, realm title, or stock holding (e.g. GUG)..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-sans"
                  />
                  {citizenSearch && (
                    <button
                      type="button"
                      onClick={() => setCitizenSearch("")}
                      className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setCitizenFilter("ALL")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                      citizenFilter === "ALL"
                        ? "bg-amber-500 text-black font-bold"
                        : "bg-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    All ({citizens.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCitizenFilter("WEALTHY")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                      citizenFilter === "WEALTHY"
                        ? "bg-amber-500 text-black font-bold"
                        : "bg-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    With Wealth &gt; 0g ({citizens.filter(c => (Number(c.cash_balance) || 0) > 0 || (c.portfolio_value && c.portfolio_value > 0)).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCitizenFilter("ADMIN")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                      citizenFilter === "ADMIN"
                        ? "bg-amber-500 text-black font-bold"
                        : "bg-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    Operators ({citizens.filter(c => !!c.is_admin).length})
                  </button>
                </div>
              </div>

              {/* Wealth & Purse Balances Table */}
              <div className="overflow-x-auto border border-zinc-800/80 rounded-xl bg-zinc-950/40">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="bg-zinc-900/90 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800 font-sans">
                      <th className="py-3 px-4">Citizen</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3 text-right">Purse Gold (Cash)</th>
                      <th className="py-3 px-3 text-right">Locked in Orders</th>
                      <th className="py-3 px-3">Stock Holdings &amp; Equities</th>
                      <th className="py-3 px-3 text-right">Total Net Worth</th>
                      <th className="py-3 px-3 text-center">Compliance</th>
                      <th className="py-3 px-4 text-center">Operator Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredCitizens.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-zinc-500 font-sans">
                          No citizens match the search query or active filter.
                        </td>
                      </tr>
                    ) : (
                      filteredCitizens.map((c) => {
                        const purseCash = Number(c.cash_balance || 0);
                        const lockedCash = Number(c.locked_cash || 0);
                        const portVal = Number(c.portfolio_value || 0);
                        const netWorth = Number(c.total_net_worth || (purseCash + lockedCash + portVal));
                        const holdings = c.holdings || [];

                        return (
                          <tr key={c.id} className="hover:bg-zinc-800/30 transition">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <span className="text-xl shrink-0">👤</span>
                                <div>
                                  <div className="text-white font-bold font-sans flex items-center gap-1.5">
                                    <span>{c.display_name || c.username}</span>
                                    {c.is_admin ? (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                        🛡️ ADMIN
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="text-[10px] text-zinc-400 font-sans flex items-center gap-1.5 mt-0.5">
                                    <span className="font-mono text-zinc-300">@{c.username}</span>
                                    {c.parlamentum_name && c.parlamentum_name !== c.username && (
                                      <span className="text-zinc-500">· Game: {c.parlamentum_name}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3 text-[11px] font-sans whitespace-nowrap">
                              {c.is_admin ? (
                                <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold whitespace-nowrap inline-flex items-center gap-1">
                                  🛡️ Operator
                                </span>
                              ) : (
                                <span className="text-zinc-400 whitespace-nowrap inline-flex items-center gap-1">
                                  👤 Citizen
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="font-mono font-black text-emerald-400 text-sm">
                                {purseCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setAdjustingCitizen(c);
                                  setAdjustBalanceValue(String(purseCash));
                                  setAdjustReason(`Operator purse adjustment for @${c.username}`);
                                }}
                                className="text-[10px] font-sans text-amber-400/80 hover:text-amber-300 underline cursor-pointer mt-0.5"
                                title="Adjust this citizen's purse balance"
                              >
                                Adjust Purse
                              </button>
                            </td>

                            <td className="py-3 px-3 text-right font-mono text-zinc-400 whitespace-nowrap">
                              {lockedCash > 0 ? (
                                <span className="text-amber-300 font-semibold">
                                  {lockedCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                                </span>
                              ) : (
                                "0.00g"
                              )}
                            </td>

                            <td className="py-3 px-3">
                              {holdings.length === 0 ? (
                                <span className="text-zinc-500 font-sans text-[11px] whitespace-nowrap">No shares held</span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5 max-w-[340px]">
                                  {holdings.map((h, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-[10px] font-mono text-purple-300 whitespace-nowrap inline-flex items-center gap-1"
                                      title={`${h.companyName} (${h.totalShares.toLocaleString()} shares @ ${h.currentPrice.toFixed(2)}g)`}
                                    >
                                      <b className="text-amber-400">${h.ticker}</b>: {h.totalShares.toLocaleString()} sh
                                      <span className="text-zinc-400">({h.holdingValue.toFixed(1)}g)</span>
                                    </span>
                                  ))}
                                  <div className="w-full text-[10px] text-zinc-400 font-mono mt-0.5">
                                    Valuation: {portVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                                  </div>
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right">
                              <div className="font-mono font-black text-amber-400 text-sm">
                                {netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                              </div>
                              <div className="text-[9px] text-zinc-500 font-mono">
                                Total Platform Capital
                              </div>
                            </td>

                            <td className="py-3 px-3 text-center text-[11px] font-sans">
                              {Number(c.is_frozen || 0) === 1 ? (
                                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                                  ❄️ FROZEN
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                                  Active
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1 font-sans">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAdjustingCitizen(c);
                                    setAdjustBalanceValue(String(purseCash));
                                    setAdjustReason(`Operator purse adjustment for @${c.username}`);
                                  }}
                                  className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-medium transition cursor-pointer"
                                  title="Adjust Purse Gold"
                                >
                                  ⚡ Adjust
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetCitizen(c.username);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }}
                                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-emerald-500 hover:text-black text-zinc-200 text-[10px] transition cursor-pointer"
                                  title="Load Funds into Purse"
                                >
                                  Load
                                </button>
                                {Number(c.is_frozen || 0) === 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleFreezeUser(c.id, false)}
                                    className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold transition cursor-pointer"
                                    title="Unfreeze Account"
                                  >
                                    Unfreeze
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleFreezeUser(c.id, true)}
                                    className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-800 text-rose-300 border border-rose-700/50 text-[10px] font-semibold transition cursor-pointer"
                                    title="Freeze Wallet Hammer"
                                  >
                                    Freeze
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Modal: Adjust Citizen Purse Balance */}
        {adjustingCitizen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setAdjustingCitizen(null)}
                className="absolute right-4 top-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xl">
                  💰
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Adjust Citizen Purse Balance
                  </h3>
                  <p className="text-zinc-400 text-xs">
                    Target: @{adjustingCitizen.username} ({adjustingCitizen.display_name || adjustingCitizen.username})
                  </p>
                </div>
              </div>

              <form onSubmit={handleAdjustBalance} className="space-y-4 text-xs font-sans">
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between font-mono">
                  <span className="text-zinc-400">Current Purse Balance:</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {Number(adjustingCitizen.cash_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gold
                  </span>
                </div>

                <div>
                  <label className="font-semibold text-zinc-300 block mb-1">
                    New Purse Balance (Gold)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={adjustBalanceValue}
                    onChange={(e) => setAdjustBalanceValue(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white font-mono text-base font-bold focus:outline-none focus:border-amber-400"
                  />

                  {/* Quick Delta Adjust Buttons */}
                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {[
                      { label: "+50g", delta: 50 },
                      { label: "+100g", delta: 100 },
                      { label: "+500g", delta: 500 },
                      { label: "+1000g", delta: 1000 },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => {
                          const cur = parseFloat(adjustBalanceValue) || 0;
                          setAdjustBalanceValue(Math.max(0, cur + btn.delta).toString());
                        }}
                        className="py-1 text-[10px] font-mono bg-zinc-800 hover:bg-zinc-700 rounded text-emerald-400 transition cursor-pointer"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-zinc-300 block mb-1">
                    Audit Log Reason
                  </label>
                  <input
                    type="text"
                    required
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="e.g. Operator direct balance correction"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white font-sans text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustingCitizen(null)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adjustLoading}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {adjustLoading ? "Saving Balance..." : "Save Purse Balance"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
