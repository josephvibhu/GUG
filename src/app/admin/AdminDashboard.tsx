"use client";

import { useState } from "react";
import WatcherPanel from "@/components/WatcherPanel";
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
  RefreshCw,
  ArrowRight,
  Percent,
  AlertCircle,
  Clock,
  Timer,
  Building2,
  Zap,
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
  isCreator?: boolean;
}

interface Citizen {
  id: string;
  username: string;
  display_name: string;
  parlamentum_name: string;
  cash_balance: number;
  locked_cash: number;
  portfolio_value?: number;
  trading_value?: number;
  founder_value?: number;
  total_net_worth?: number;
  corporate_treasury_balance?: number;
  total_profit_deposited?: number;
  founder_companies?: Array<{ id: string; ticker: string; name: string; treasuryBalance: number; totalProfitDeposited?: number }>;
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
  tax_rate?: number;
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
  const [tradeFee, setTradeFee] = useState<number>(0.5);
  const [listingFee, setListingFee] = useState<number>(200);

  // Discord Webhook Engine
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState<string>("");
  const [discordWhaleThreshold, setDiscordWhaleThreshold] = useState<number>(25);
  const [discordAlertsEnabled, setDiscordAlertsEnabled] = useState<boolean>(true);
  const [discordTesting, setDiscordTesting] = useState<boolean>(false);


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

  // Corporate Profit & Retained Earnings Deposit
  const [depositProfitComp, setDepositProfitComp] = useState<any | null>(null);
  const [depositProfitAmount, setDepositProfitAmount] = useState<string>("");
  const [depositProfitNotes, setDepositProfitNotes] = useState<string>("");
  const [depositProfitSource, setDepositProfitSource] = useState<"DIRECT" | "WALLET">("DIRECT");
  const [submittingProfit, setSubmittingProfit] = useState<boolean>(false);

  // Citizen Wealth Inspector
  const [citizenSearch, setCitizenSearch] = useState<string>("");
  const [citizenFilter, setCitizenFilter] = useState<"ALL" | "WEALTHY" | "ADMIN">("ALL");
  const [adjustingCitizen, setAdjustingCitizen] = useState<Citizen | null>(null);
  const [adjustBalanceValue, setAdjustBalanceValue] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("Operator purse adjustment");
  const [adjustLoading, setAdjustLoading] = useState<boolean>(false);

  const [financialSummary, setFinancialSummary] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  // A one-time password reset code, shown once to the operator to send privately
  const [resetCode, setResetCode] = useState<{ username: string; code: string; expiresAt: string } | null>(null);
  const [resetCopied, setResetCopied] = useState(false);

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
        if (data.financialSummary) setFinancialSummary(data.financialSummary);
        if (data.companies && data.companies.length > 0 && !divCompanyId) {
          setDivCompanyId(data.companies[0].id);
        }
        if (data.settings) {
          setTaxRate(data.settings.taxRate);
          setHouseName(data.settings.houseName);
          if (data.settings.tradeFee !== undefined) setTradeFee(data.settings.tradeFee);
          if (data.settings.listingFee !== undefined) setListingFee(data.settings.listingFee);
          if (data.settings.discordWebhookUrl !== undefined) setDiscordWebhookUrl(data.settings.discordWebhookUrl);
          if (data.settings.discordWhaleThreshold !== undefined) setDiscordWhaleThreshold(data.settings.discordWhaleThreshold);
          if (data.settings.discordAlertsEnabled !== undefined) setDiscordAlertsEnabled(data.settings.discordAlertsEnabled);
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

  const handleResetCode = async (userId: string, username: string) => {
    if (!confirm(`Make a one-time password reset code for ${username}? Any older code for them stops working.`)) return;
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_reset_code", userId }),
      });
      const data = await res.json();
      if (data.success) {
        setResetCopied(false);
        setResetCode({ username: data.username, code: data.code, expiresAt: data.expiresAt });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setFeedback({ type: "error", message: data.message });
      }
    } catch {
      setFeedback({ type: "error", message: "Couldn't reach the exchange. Try again." });
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

  const handleDepositProfitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositProfitComp) return;
    const amount = parseFloat(depositProfitAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid positive gold amount.");
      return;
    }
    setSubmittingProfit(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deposit_company_profit",
          companyId: depositProfitComp.id,
          amount,
          notes: depositProfitNotes || `Audited operating profit credited to $${depositProfitComp.ticker} corporate treasury`,
          source: depositProfitSource,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: data.message });
        setDepositProfitComp(null);
        setDepositProfitAmount("");
        setDepositProfitNotes("");
        fetchAdminData();
      } else {
        alert(data.message || "Failed to deposit corporate profit.");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setSubmittingProfit(false);
    }
  };


  // Every user and portfolio comes back on each load: every 15 s, paused in hidden tabs (was 6 s, always)
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
          tradeFee: Number(tradeFee),
          listingFee: Number(listingFee),
          discordWebhookUrl,
          discordWhaleThreshold: Number(discordWhaleThreshold),
          discordAlertsEnabled,
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

  const handleTestDiscordWebhook = async () => {
    if (!discordWebhookUrl) {
      setFeedback({ type: "error", message: "Please enter a Discord Webhook URL first." });
      return;
    }
    setDiscordTesting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_discord_webhook",
          webhookUrl: discordWebhookUrl,
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
    } finally {
      setDiscordTesting(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-floor text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center tabular text-xs text-bullion">
          Verifying operator credentials...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-floor text-white flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center max-w-md mx-auto">
          <Shield className="w-12 h-12 text-rose-500 mb-3" />
          <h2 className="text-xl font-bold">Operator Authorization Required</h2>
          <p className="text-xs text-zinc-400 mt-2 mb-6">
            This dashboard is reserved for the exchange operator. Log in with an account registered with the operator access code.
          </p>
          <Link
            href="/login"
            className="px-5 py-2.5 bg-amber-500 text-black font-bold rounded-[6px] text-xs hover:bg-amber-400 transition"
          >
            Log in as Operator
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-floor text-zinc-100 flex flex-col font-sans">
      <Navbar onUserRefresh={fetchAdminData} />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6 flex-1">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rule">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏛️</span>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Operator Control Panel
              </h1>
              <span className="text-[10px] bg-floor text-bullion border border-rule px-2 py-0.5 rounded tabular font-bold">
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
            className={`p-3 rounded-[6px] flex items-center gap-2 text-xs border ${
              feedback.type === "success"
                ? "bg-floor border-rule text-paper"
                : "bg-floor border-rule text-bear"
            }`}
          >
            {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {resetCode && (
          <div role="status" className="p-4 rounded-[6px] border border-bullion/60 bg-floor flex flex-col gap-2 text-[13px]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-paper">
                Reset code for <strong className="text-zinc-50">{resetCode.username}</strong>, valid until{" "}
                {resetCode.expiresAt.slice(0, 16).replace("T", " ")} UTC
              </span>
              <button type="button" onClick={() => setResetCode(null)} className="text-[12px] text-ash hover:text-paper">
                Hide
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="condensed tabular text-[26px] font-bold text-zinc-50 tracking-wide select-all">{resetCode.code}</span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(resetCode.code);
                    setResetCopied(true);
                  } catch {
                    setResetCopied(false);
                  }
                }}
                className="h-8 px-3 rounded-[4px] border border-rule hover:border-zinc-500 text-[12px] text-paper"
              >
                {resetCopied ? "Copied" : "Copy code"}
              </button>
            </div>
            <p className="text-[12px] text-ash leading-relaxed">
              Send it to {resetCode.username} privately (Discord DM or an in-game message), never in a public channel. They open the login
              page, choose &quot;Change your password&quot;, then &quot;I have a reset code&quot;, and pick their own password. It works once, and this
              is the only time it is shown.
            </p>
          </div>
        )}

        {/* Operator Financial Ledger & Vault Profits */}
        {financialSummary && (
          <div className="bg-pane border border-rule rounded-[6px] p-5 sm:p-6 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rule pb-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-[6px] bg-floor border border-rule flex items-center justify-center text-bullion shrink-0">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-extrabold text-white text-lg tracking-tight">
                      Operator Vault & Exchange Profit Ledger
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] tabular font-bold bg-floor text-paper border border-rule">
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
                <span className="tabular text-xl sm:text-2xl font-black text-paper">
                  +{Number(financialSummary.totalPlatformProfit || 0).toLocaleString()} gold
                </span>
              </div>
            </div>

            {/* Key Metric Pillars */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 tabular">
              {/* Operator Personal Purse */}
              <div className="p-4 bg-floor/90 border border-rule rounded-[6px] flex flex-col justify-between gap-1 shadow-inner">
                <div className="flex items-center justify-between text-[11px] font-sans text-paper font-semibold">
                  <span>Your Operator Purse</span>
                  <Wallet className="w-3.5 h-3.5 text-bullion" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-bullion mt-1">
                  {Number(financialSummary.operatorCash || 0).toLocaleString()} <span className="text-xs text-paper font-normal">gold</span>
                </div>
                <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between pt-1 border-t border-rule">
                  <span>In Open Orders:</span>
                  <span className="text-zinc-300 tabular">{Number(financialSummary.operatorLocked || 0).toLocaleString()} gold</span>
                </div>
              </div>

              {/* Exchange Treasury Vault */}
              <div className="p-4 bg-floor/90 border border-rule rounded-[6px] flex flex-col justify-between gap-1 shadow-inner">
                <div className="flex items-center justify-between text-[11px] font-sans text-zinc-300 font-semibold">
                  <span>Exchange Treasury</span>
                  <Landmark className="w-3.5 h-3.5 text-paper" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-paper mt-1">
                  {Number(financialSummary.treasuryBalance || 0).toLocaleString()} <span className="text-xs text-paper font-normal">gold</span>
                </div>
                <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between pt-1 border-t border-rule">
                  <span>Vault Account:</span>
                  <span className="text-zinc-400 tabular">usr_treasury</span>
                </div>
              </div>

              {/* Trade Fees Earned */}
              <div className="p-4 bg-floor/90 border border-rule rounded-[6px] flex flex-col justify-between gap-1 shadow-inner">
                <div className="flex items-center justify-between text-[11px] font-sans text-zinc-300 font-semibold">
                  <span>Trading Fees (0.5%)</span>
                  <TrendingUp className="w-3.5 h-3.5 text-paper" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-paper mt-1">
                  +{Number(financialSummary.totalTradeFees || 0).toLocaleString()} <span className="text-xs text-paper font-normal">gold</span>
                </div>
                <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between pt-1 border-t border-rule">
                  <span>Vol: {Number(financialSummary.totalTradeVolume || 0).toLocaleString()}g</span>
                  <span className="text-zinc-300">{financialSummary.tradeCount || 0} trades</span>
                </div>
              </div>

              {/* Citizen Gold Liabilities */}
              <div className="p-4 bg-floor/90 border border-rule rounded-[6px] flex flex-col justify-between gap-1 shadow-inner">
                <div className="flex items-center justify-between text-[11px] font-sans text-zinc-300 font-semibold">
                  <span>Total Citizen Gold</span>
                  <Users className="w-3.5 h-3.5 text-paper" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-paper mt-1">
                  {Number(financialSummary.totalCitizenGold || 0).toLocaleString()} <span className="text-xs text-paper font-normal">gold</span>
                </div>
                <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between pt-1 border-t border-rule">
                  <span>Circulating Supply</span>
                  <span className="text-zinc-300">{financialSummary.citizenCount || 0} citizens</span>
                </div>
              </div>
            </div>

            {/* Inflow vs Outflow Ledger Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 bg-floor/60 border border-rule rounded-[6px] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-zinc-400 font-sans block">Total Gold Deposited (Inflow)</span>
                  <span className="tabular text-sm font-bold text-paper">
                    +{Number(financialSummary.totalDepositedGold || 0).toLocaleString()} gold
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500 tabular bg-pane px-2 py-1 rounded border border-rule">
                  {Number(financialSummary.totalIronUnitsDeposited || 0).toLocaleString()} Raw Iron
                </span>
              </div>

              <div className="p-3 bg-floor/60 border border-rule rounded-[6px] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-zinc-400 font-sans block">Total Gold Withdrawn (Outflow)</span>
                  <span className="tabular text-sm font-bold text-bear">
                    -{Number(financialSummary.totalWithdrawnGold || 0).toLocaleString()} gold
                  </span>
                </div>
                {Number(financialSummary.pendingWithdrawalsGold || 0) > 0 && (
                  <span className="text-[10px] text-paper tabular bg-floor px-2 py-1 rounded border border-rule">
                    {financialSummary.pendingWithdrawalsGold}g pending
                  </span>
                )}
              </div>

              <div className="p-3 bg-floor/60 border border-rule rounded-[6px] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-zinc-400 font-sans block">Net Gold Held Under Custody</span>
                  <span className="tabular text-sm font-bold text-zinc-100">
                    {Number(financialSummary.netGoldInCustody || 0).toLocaleString()} gold
                  </span>
                </div>
                <span className="text-[10px] text-bullion tabular bg-floor px-2 py-1 rounded border border-rule">
                  IPO Fees: +{Number(financialSummary.totalIpoFees || financialSummary.totalListingFees || 0).toLocaleString()}g
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Deposits: the watcher credits Raw Iron purchases from the House's game ledger; below, by hand */}
        <WatcherPanel />

        {/* Section 1: Live Pending Deposit Queue & Manual Credit Tool */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Manual Purse Loader (5 cols) */}
          <div className="lg:col-span-5 bg-pane/60 border border-rule rounded-[6px] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <h2 className="font-bold text-white text-sm flex items-center gap-2">
                <Coins className="w-4 h-4 text-paper" />
                Load Citizen Purse from Game Sale
              </h2>
              <span className="text-[10px] text-zinc-400 tabular">1 Raw Iron = 10g</span>
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
                  className="w-full bg-floor border border-rule rounded-[4px] px-3 py-2 text-xs tabular text-white focus:outline-none focus:border-rule"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold text-zinc-300 mb-1">
                  <span>Gold Amount to Credit</span>
                  <span className="tabular text-zinc-400">
                    = {Math.ceil(parseFloat(creditAmount || "0") / 10)} Raw Iron
                  </span>
                </div>
                <input
                  type="number"
                  min="10"
                  step="10"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="w-full bg-floor border border-rule rounded-[4px] px-3 py-2 text-sm tabular text-paper font-bold focus:outline-none focus:border-rule"
                />

                {/* Quick Raw Iron units presets */}
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {[
                    { iron: 10, gold: 100 },
                    { iron: 50, gold: 500 },
                    { iron: 100, gold: 1000 },
                    { iron: 250, gold: 2500 },
                  ].map((preset) => (
                    <button
                      key={preset.iron}
                      type="button"
                      onClick={() => setCreditAmount(preset.gold.toString())}
                      className="py-1 text-[10px] tabular bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition cursor-pointer"
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
                  className="w-full bg-floor border border-rule rounded-[4px] px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-rule"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-[6px] bg-bullion hover:bg-amber-300 text-floor font-bold text-xs tracking-wide transition cursor-pointer mt-1"
              >
                Credit {creditAmount} Gold to {targetCitizen || "Citizen"}
              </button>
            </form>
          </div>

          {/* Pending Deposit Announcements (7 cols) */}
          <div className="lg:col-span-7 bg-pane/60 border border-rule rounded-[6px] p-5 flex flex-col">
            <div className="flex items-center justify-between border-b border-rule pb-3 mb-3">
              <h2 className="font-bold text-white text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-bullion" />
                Pending In-Game Deposit Announcements
              </h2>
              <span className="text-[11px] tabular text-zinc-400">
                {pendingDeposits.length} awaiting review
              </span>
            </div>

            {pendingDeposits.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 text-xs flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-zinc-600" />
                <span>All citizen deposits have been cleared and verified!</span>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto max-h-[340px] pr-1 scrollbar-thin">
                {pendingDeposits.map((tx) => {
                  const isWithdrawal = tx.type === "WITHDRAWAL";
                  return (
                    <div
                      key={tx.id}
                      className={`p-3 bg-floor border rounded-[6px] flex items-center justify-between gap-3 text-xs ${
                        isWithdrawal ? "border-rule bg-floor" : "border-rule"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          {isWithdrawal ? (
                            <>
                              <span className="px-1.5 py-0.5 rounded bg-floor text-paper tabular text-[10px] font-bold">
                                🔻 WITHDRAWAL PAYOUT
                              </span>
                              {tx.tax_rate !== undefined && (
                                <span className="px-1.5 py-0.5 rounded bg-floor text-paper tabular text-[10px] font-bold">
                                  🏛️ {tx.tax_rate}% Regional Tax
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-floor text-paper tabular text-[10px] font-bold">
                              🟢 DEPOSIT
                            </span>
                          )}
                          <span>@{tx.parlamentum_name}</span>
                          <span className={`tabular font-bold ${isWithdrawal ? "text-bullion" : "text-paper"}`}>
                            {isWithdrawal ? "-" : "+"}{tx.amount.toLocaleString()} gold ({tx.iron_units} Raw Iron)
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-300 mt-1 line-clamp-2">
                          {tx.recipe_note}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-1 tabular">
                          {new Date(tx.created_at).toLocaleTimeString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isWithdrawal ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRejectTransaction(tx.id)}
                              className="px-2.5 py-1.5 rounded-[4px] bg-zinc-800 hover:bg-rose-950 text-bear text-xs font-semibold transition cursor-pointer"
                              title="Cancel withdrawal and refund gold to purse"
                            >
                              Refund
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveDeposit(tx.id)}
                              className="px-3 py-1.5 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-bold text-xs transition cursor-pointer"
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
                              className="px-2.5 py-1.5 rounded-[4px] bg-zinc-800 hover:bg-rose-950 text-bear text-xs font-semibold transition cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveDeposit(tx.id)}
                              className="px-3 py-1.5 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-bold text-xs transition cursor-pointer"
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

        {/* Section 2.5: Market Trading Hours & Floor Controls (UTC) */}
        <div className="bg-pane/60 border border-rule rounded-[6px] p-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-rule pb-3 gap-2">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-paper" />
                Parlamentum Bourse Trading Hours (UTC)
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Current week trading session: <strong>15:30 – 16:30 UTC</strong> (3:30 PM – 4:30 PM UTC). Order placement is blocked when the floor is closed.
              </p>
            </div>

            {marketSchedule && (
              <div className="flex items-center gap-2 bg-floor border border-rule px-3 py-1.5 rounded-[6px] tabular text-xs">
                <span className={`w-2.5 h-2.5 rounded-full ${marketSchedule.isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                <span className={marketSchedule.isOpen ? "text-paper font-bold" : "text-bear font-bold"}>
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
                className="w-full bg-floor border border-rule rounded-[4px] px-3 py-2 tabular text-white text-sm focus:outline-none focus:border-rule"
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
                className="w-full bg-floor border border-rule rounded-[4px] px-3 py-2 tabular text-white text-sm focus:outline-none focus:border-rule"
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
                  className="flex-1 py-2 px-2 bg-zinc-800 hover:bg-zinc-700 rounded-[4px] tabular text-[11px] text-paper text-center transition cursor-pointer"
                >
                  1h (15:30-16:30 UTC)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenTime("15:30");
                    setCloseTime("17:30");
                  }}
                  className="flex-1 py-2 px-2 bg-zinc-800 hover:bg-zinc-700 rounded-[4px] tabular text-[11px] text-zinc-300 text-center transition cursor-pointer"
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
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-rule">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 font-semibold">Floor Mode:</span>
              <button
                type="button"
                onClick={() => handleSaveSchedule("auto")}
                className={`px-3 py-1.5 rounded-[4px] text-xs tabular font-bold transition cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-[4px] text-xs tabular font-bold transition cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-[4px] text-xs tabular font-bold transition cursor-pointer ${
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
              className="px-4 py-2 rounded-[6px] bg-bullion hover:bg-amber-300 text-floor font-bold text-xs transition cursor-pointer"
            >
              Save Schedule ({openTime} – {closeTime} UTC)
            </button>
          </div>
        </div>

        {/* Section 2.8: IPO Applications & Price Negotiation Queue */}
        <div className="bg-pane/60 border border-rule rounded-[6px] p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-rule pb-3">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-paper" />
                IPO Charter Applications & Price Negotiation Queue
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Companies cannot list independently. Review founder applications, negotiate IPO prices, and approve them onto the bourse floor.
              </p>
            </div>
            <span className="text-[11px] tabular text-paper font-bold bg-floor border border-rule px-2.5 py-1 rounded-[4px]">
              {ipoApplications.length} Pending Charters
            </span>
          </div>

          {ipoApplications.length === 0 ? (
            <div className="py-10 text-center text-zinc-400 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-zinc-600" />
              <span>No pending IPO applications. All corporate filings are processed!</span>
              <span className="text-[10px] text-zinc-500">
                Founders submit charter requests on the <Link href="/ipo" className="text-bullion underline">Launch IPO</Link> page.
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
                  <div key={app.id} className="bg-floor border border-rule rounded-[6px] p-4 flex flex-col gap-4 text-xs">
                    {/* Header: Company info and Applicant */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rule pb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl p-1.5 bg-pane border border-rule rounded-[4px]">{app.logoUrl}</span>
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-2">
                            <span>{app.name}</span>
                            <span className="tabular text-bullion font-bold">(${app.ticker})</span>
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5 flex flex-wrap items-center gap-2">
                            <span>Sector: <strong className="text-zinc-300">{app.sector}</strong></span>
                            <span>·</span>
                            <span>Applicant: <strong className="text-paper">@{app.parlamentumName}</strong></span>
                            <span>·</span>
                            <span className="px-2 py-0.5 rounded bg-floor border border-rule text-paper tabular font-bold text-[10px]">
                              💬 Discord: {app.discordId ? `@${app.discordId}` : "None"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right tabular text-[11px] text-zinc-400">
                        <div>Submitted: {new Date(app.createdAt).toLocaleDateString()} {new Date(app.createdAt).toLocaleTimeString()}</div>
                      </div>
                    </div>

                    {/* Rich Metrics & Backing Assets Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 bg-pane/80 rounded-[4px] border border-rule text-[11px]">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold block">Model & Classification</span>
                        <span className="text-bullion font-semibold flex items-center gap-1 mt-0.5">
                          {app.businessType === "FACTORY" ? "🏭 Industrial / Factory" : app.businessType === "PRESS" ? "📰 Newspaper & Press" : "⚜️ Special Enterprise"}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold block">Est. Weekly Revenue</span>
                        <span className="tabular text-paper font-bold text-xs mt-0.5 block">
                          {app.weeklyRevenue ? `${Number(app.weeklyRevenue).toLocaleString()} gold / wk` : "0 gold"}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold block">Specific Production / Metrics</span>
                        <span className="tabular text-zinc-300 text-xs mt-0.5 block truncate">
                          {app.businessType === "FACTORY" 
                            ? `Lvl ${app.factoryLevel || 1} · ${app.workersCount || 0} workers · ${app.productionOutput || "Standard"}`
                            : app.businessType === "PRESS"
                            ? `${app.pressViewers || "General"} readers (${app.pressFrequency || "Weekly"})`
                            : (app.specialNotes || "Special Lore")}
                        </span>
                      </div>
                    </div>

                    {/* Business Lore & In-Game Backing */}
                    <div className="p-3 bg-pane/60 rounded-[4px] border border-rule text-[11px] leading-relaxed text-zinc-300">
                      <strong className="text-bullion font-sans block mb-1">Business Lore & Backing Assets:</strong>
                      {app.description}
                    </div>

                    {/* Applicant's Proposed Equity & Valuation Breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2.5 bg-floor border border-rule rounded-[6px]">
                        <span className="text-[10px] uppercase font-bold text-paper block">
                          🪙 Public Float (% Putting Out)
                        </span>
                        <div className="tabular text-base font-extrabold text-bullion mt-0.5">
                          {proposedFloat.toFixed(2)}%
                        </div>
                        <div className="text-[10px] text-zinc-400 tabular mt-0.5">
                          {proposedFloatShares.toLocaleString()} shares to list
                        </div>
                      </div>

                      <div className="p-2.5 bg-floor border border-rule rounded-[6px]">
                        <span className="text-[10px] uppercase font-bold text-paper block">
                          🏛️ Founder Retained Stake
                        </span>
                        <div className="tabular text-base font-extrabold text-paper mt-0.5">
                          {proposedFounderPct.toFixed(2)}%
                        </div>
                        <div className="text-[10px] text-zinc-400 tabular mt-0.5">
                          {proposedFounderShares.toLocaleString()} shares kept
                        </div>
                      </div>

                      <div className="p-2.5 bg-floor border border-rule rounded-[6px]">
                        <span className="text-[10px] uppercase font-bold text-paper block">
                          💰 Float Capital Raised
                        </span>
                        <div className="tabular text-base font-extrabold text-paper mt-0.5">
                          {proposedFloatCap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                        </div>
                        <div className="text-[10px] text-zinc-400 tabular mt-0.5">
                          at {proposedPrice.toFixed(2)}g / share
                        </div>
                      </div>

                      <div className="p-2.5 bg-pane border border-rule rounded-[6px]">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                          📊 Total Valuation
                        </span>
                        <div className="tabular text-base font-extrabold text-white mt-0.5">
                          {proposedTotalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                        </div>
                        <div className="text-[10px] text-zinc-400 tabular mt-0.5">
                          {proposedShares.toLocaleString()} total shares
                        </div>
                      </div>
                    </div>

                    {/* Sovereign Negotiation & Float Adjuster */}
                    <div className="p-3 bg-pane/40 rounded-[6px] border border-rule space-y-3">
                      <div className="flex items-center justify-between border-b border-rule pb-2">
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
                            <label className="text-[10px] uppercase font-bold text-bullion">
                              Public Float % (Putting Out)
                            </label>
                            <span className="tabular text-[10px] text-zinc-400">
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
                              className="w-full bg-floor border border-rule rounded-[4px] pl-2.5 pr-8 py-1.5 tabular text-bullion font-bold text-xs focus:outline-none focus:border-rule"
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
                                className={`px-1.5 py-0.5 rounded text-[9px] tabular transition cursor-pointer border ${
                                  formState.floatPercent === pill.val
                                    ? "bg-amber-500 text-black font-bold border-rule"
                                    : "bg-zinc-800 text-zinc-400 hover:text-white border-rule"
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
                            <label className="text-[10px] uppercase font-bold text-paper">
                              IPO Price (Gold / Share)
                            </label>
                            <span className="tabular text-[10px] text-zinc-400">
                              Prop: {app.proposedIpoPrice}g
                            </span>
                          </div>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={formState.price}
                            onChange={(e) => updateForm("price", e.target.value)}
                            className="w-full bg-floor border border-rule rounded-[4px] px-2.5 py-1.5 tabular text-paper font-bold text-xs focus:outline-none focus:border-rule"
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
                            <span className="tabular text-[10px] text-zinc-400">
                              Prop: {app.proposedTotalShares.toLocaleString()}
                            </span>
                          </div>
                          <input
                            type="number"
                            step="1000"
                            min="1000"
                            value={formState.shares}
                            onChange={(e) => updateForm("shares", e.target.value)}
                            className="w-full bg-floor border border-rule rounded-[4px] px-2.5 py-1.5 tabular text-white text-xs focus:outline-none focus:border-rule"
                          />
                          <span className="text-[10px] text-zinc-400 mt-1.5 block tabular">
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
                            className="w-full bg-floor border border-rule rounded-[4px] px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-rule"
                          />
                          <span className="text-[10px] text-zinc-400 mt-1.5 block">
                            Visible on company floor dossier
                          </span>
                        </div>
                      </div>

                      {/* Live Listing Execution Breakdown */}
                      <div className="p-2.5 bg-floor rounded-[4px] border border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-zinc-400">Opening Bourse Float:</span>
                          <strong className="text-bullion tabular">{negotiatedFloatShares.toLocaleString()} shares ({parsedFloat.toFixed(2)}%)</strong>
                          <span className="text-zinc-600">·</span>
                          <span className="text-zinc-400">Founder Retains:</span>
                          <strong className="text-paper tabular">{negotiatedFounderShares.toLocaleString()} shares ({parsedFounderPct.toFixed(2)}%)</strong>
                          <span className="text-zinc-600">·</span>
                          <span className="text-zinc-400">Float Capital Raised:</span>
                          <strong className="text-paper tabular">{negotiatedFloatCap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gold</strong>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleRejectIPO(app.id)}
                        className="px-4 py-2 rounded-[4px] bg-zinc-800 hover:bg-rose-950 text-bear border border-rule font-semibold text-xs transition cursor-pointer"
                      >
                        Reject Charter
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApproveIPO(app.id)}
                        className="px-5 py-2 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
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
        <form onSubmit={handleSaveSettings} className="bg-pane/60 border border-rule rounded-[6px] p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-rule pb-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-bullion" />
              Realm Market Tax Negation & House Configuration
            </h3>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-bold text-xs transition cursor-pointer"
            >
              Save Settings
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="font-semibold text-zinc-300 block mb-1">
                Default Regional Market Tax (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="40"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-floor border border-rule rounded-[4px] pl-3 pr-8 py-2 tabular text-white text-sm focus:outline-none focus:border-rule"
                />
                <Percent className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-3" />
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Fallback tax negated on withdrawals. Citizens can select their specific regional tax rate (e.g. 3% in Kriti).
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
                  className="w-full bg-floor border border-rule rounded-[4px] pl-3 pr-8 py-2 tabular text-paper font-bold text-sm focus:outline-none focus:border-rule"
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
                  className="w-full bg-floor border border-rule rounded-[4px] pl-3 pr-8 py-2 tabular text-paper font-bold text-sm focus:outline-none focus:border-rule"
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
                className="w-full bg-floor border border-rule rounded-[4px] px-3 py-2 tabular text-white text-sm focus:outline-none focus:border-rule"
              />
              <span className="text-[10px] text-zinc-400 mt-1 block">
                In-game character name where players buy Raw Iron from.
              </span>
            </div>

          </div>
        </form>

        {/* Section 3.25: Discord Webhooks & Community Hype Engine */}
        <div className="bg-pane border border-rule rounded-[6px] p-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rule pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">📢</span>
                <h3 className="font-bold text-white text-sm">
                  Discord Webhooks &amp; Community Hype Engine
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${discordWebhookUrl ? "bg-floor text-paper border border-rule" : "bg-zinc-800 text-zinc-400"}`}>
                  {discordWebhookUrl ? "Active" : "Not Configured"}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Automatically posts real-time Whale Trade Alerts, Operator Deposit Pings, and new IPO Float announcements to your Discord server.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleTestDiscordWebhook}
                disabled={discordTesting}
                className="px-3 py-1.5 rounded-[6px] bg-floor hover:bg-floor border border-rule text-paper font-bold text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {discordTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Ping...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-paper" />
                    <span>Send Test Alert</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
            <div className="lg:col-span-6">
              <label className="font-semibold text-zinc-300 block mb-1">
                Discord Webhook URL
              </label>
              <input
                type="text"
                placeholder="https://discord.com/api/webhooks/..."
                value={discordWebhookUrl}
                onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                className="w-full bg-floor border border-rule rounded-[4px] px-3 py-2 tabular text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-rule"
              />
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Paste the Webhook URL from your Discord channel settings (Integrations → Webhooks). Remember to click &ldquo;Save Settings&rdquo; above!
              </span>
            </div>

            <div className="lg:col-span-3">
              <label className="font-semibold text-zinc-300 block mb-1">
                Whale Trade Threshold (gold)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="5"
                  value={discordWhaleThreshold}
                  onChange={(e) => setDiscordWhaleThreshold(parseFloat(e.target.value) || 0)}
                  className="w-full bg-floor border border-rule rounded-[4px] pl-3 pr-8 py-2 tabular text-paper font-bold text-xs focus:outline-none focus:border-rule"
                />
                <Coins className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-2.5" />
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Trades &ge; this total value trigger a special 🚨 Whale Alert.
              </span>
            </div>

            <div className="lg:col-span-3">
              <label className="font-semibold text-zinc-300 block mb-1">
                Alerts Toggle
              </label>
              <select
                value={discordAlertsEnabled ? "true" : "false"}
                onChange={(e) => setDiscordAlertsEnabled(e.target.value === "true")}
                className="w-full bg-floor border border-rule rounded-[4px] px-3 py-2 text-xs text-white focus:outline-none focus:border-rule"
              >
                <option value="true">Enabled (Broadcasting)</option>
                <option value="false">Muted (Disabled)</option>
              </select>
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Quickly mute alerts during scheduled maintenance.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] text-zinc-400 border-t border-rule">
            <div className="flex items-start gap-2">
              <span className="text-paper font-bold">🚨</span>
              <span><strong>Whale Trades:</strong> Sweeping order book floats and large block trades post immediately.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-bullion font-bold">📥</span>
              <span><strong>Deposit Pings:</strong> Alerts you the second a citizen announces a deposit on GUG.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-paper font-bold">🚀</span>
              <span><strong>IPO Launches:</strong> Welcomes newly chartered companies and alerts traders to initial floats.</span>
            </div>
          </div>
        </div>

        {/* Section 4: Listed Companies & Ticker Controls (Method 5) */}
        <div className="bg-pane/60 border border-rule rounded-[6px] p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-rule pb-3">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-bullion" />
                Listed Companies & Ticker Floor Controls (Method 5)
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Operator power over tickers: temporarily halt trading for price stabilization or flag defaulting/scam companies.
              </p>
            </div>
            <span className="text-[11px] tabular text-zinc-400">
              {companies.length} chartered
            </span>
          </div>

          {/* IPO Float & Sales Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-floor/70 border-b border-rule">
            <div className="p-3 bg-pane/60 rounded-[6px] border border-rule">
              <div className="text-[10px] uppercase font-sans font-bold text-zinc-400">Total IPO Float</div>
              <div className="text-lg tabular font-black text-white mt-0.5">
                {companies.reduce((sum, c) => sum + (c.floatShares || 0), 0).toLocaleString()} <span className="text-xs font-normal text-zinc-500">shares</span>
              </div>
              <div className="text-[10px] text-zinc-400 font-sans mt-0.5">
                Primary public offerings
              </div>
            </div>

            <div className="p-3 bg-pane/60 rounded-[6px] border border-rule">
              <div className="text-[10px] uppercase font-sans font-bold text-paper">IPO Float Sold</div>
              <div className="text-lg tabular font-black text-paper mt-0.5">
                {companies.reduce((sum, c) => sum + (c.sharesSold || 0), 0).toLocaleString()} <span className="text-xs font-normal text-emerald-500">
                  ({(() => {
                    const totalListed = companies.reduce((sum, c) => sum + (c.floatShares || 0), 0);
                    const totalSold = companies.reduce((sum, c) => sum + (c.sharesSold || 0), 0);
                    return totalListed > 0 ? Math.round((totalSold / totalListed) * 100) : 0;
                  })()}%)
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 font-sans mt-0.5">
                Absorbed from IPOs
              </div>
            </div>

            <div className="p-3 bg-pane/60 rounded-[6px] border border-rule">
              <div className="text-[10px] uppercase font-sans font-bold text-paper">Active Book Asks</div>
              <div className="text-lg tabular font-black text-paper mt-0.5">
                {companies.reduce((sum, c) => sum + (c.totalActiveAsks || 0), 0).toLocaleString()} <span className="text-xs font-normal text-bullion">
                  ({companies.reduce((sum, c) => sum + (c.secondaryAsks || 0), 0).toLocaleString()} secondary)
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 font-sans mt-0.5">
                {companies.reduce((sum, c) => sum + (c.sharesRemaining || 0), 0).toLocaleString()} IPO left · {companies.reduce((sum, c) => sum + (c.secondaryAsks || 0), 0).toLocaleString()} secondary
              </div>
            </div>

            <div className="p-3 bg-pane/60 rounded-[6px] border border-rule">
              <div className="text-[10px] uppercase font-sans font-bold text-paper">Corporate Treasuries</div>
              <div className="text-lg tabular font-black text-paper mt-0.5">
                {companies.reduce((sum, c) => sum + (c.treasuryBalance || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-cyan-500">gold</span>
              </div>
              <div className="text-[10px] text-zinc-400 font-sans mt-0.5">
                Capital raised &amp; profits
              </div>
            </div>
          </div>

          {companies.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              0 companies currently listed on the exchange.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left tabular text-xs">
                <thead>
                  <tr className="bg-pane/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-rule font-sans">
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Founder</th>
                    <th className="py-3 px-4 text-right">Last Price</th>
                    <th className="py-3 px-4 text-right">IPO Float</th>
                    <th className="py-3 px-4 text-right">IPO Sold</th>
                    <th className="py-3 px-4 text-right">IPO Left</th>
                    <th className="py-3 px-4 text-right">Secondary Asks</th>
                    <th className="py-3 px-4 text-right">Total Book Asks</th>
                    <th className="py-3 px-4 text-right">Corporate Treasury</th>
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
                            <Link href={`/trade/${cmp.ticker}`} className="text-white font-bold font-sans hover:text-bullion transition">
                              {cmp.name}
                            </Link>
                            <span className="tabular text-bullion font-bold ml-1.5 text-[11px]">
                              ${cmp.ticker}
                            </span>
                            {cmp.weeklyRevenue ? (
                              <span className="text-[10px] text-paper tabular ml-2 font-normal">
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
                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-white tabular">
                          {(cmp.floatShares || 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-zinc-400 tabular">
                          of {(cmp.totalShares || 0).toLocaleString()} total
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-paper tabular">
                          {(cmp.sharesSold || 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-zinc-400 tabular">
                          {cmp.floatShares > 0 ? `${Math.round(((cmp.sharesSold || 0) / cmp.floatShares) * 100)}%` : "0%"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(cmp.sharesRemaining || 0) === 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-floor text-bear border border-rule text-[10px] font-bold tabular">
                            0 (Sold Out 🔥)
                          </span>
                        ) : (
                          <div>
                            <div className="font-bold text-paper tabular">
                              {(cmp.sharesRemaining || 0).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-zinc-400 tabular">
                              available
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(cmp.secondaryAsks || 0) > 0 ? (
                          <div>
                            <div className="font-bold text-bullion tabular">
                              {Number(cmp.secondaryAsks).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-zinc-400 tabular">
                              {cmp.minSecondaryPrice === cmp.maxSecondaryPrice
                                ? `@ ${Number(cmp.minSecondaryPrice).toFixed(2)}g`
                                : `@ ${Number(cmp.minSecondaryPrice).toFixed(2)}g - ${Number(cmp.maxSecondaryPrice).toFixed(2)}g`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-500 tabular">–</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(cmp.totalActiveAsks || 0) === 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-floor text-ash border border-rule text-[10px] tabular">
                            0 (No Asks)
                          </span>
                        ) : (
                          <div>
                            <div className="font-bold text-white tabular">
                              {Number(cmp.totalActiveAsks).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-emerald-400 tabular">
                              for sale now
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-paper tabular">
                          {(cmp.treasuryBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                        </div>
                        <div className="text-[10px] text-zinc-400 tabular">
                          +{(cmp.totalProfitDeposited || 0).toFixed(2)}g profit
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-paper">
                        {cmp.sharesBoughtBack ? `${cmp.sharesBoughtBack.toLocaleString()} shares` : "0"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {cmp.status === "HALTED" ? (
                          <span className="px-2 py-0.5 rounded bg-floor text-paper border border-rule text-[10px] font-bold">
                            ⏸️ HALTED
                          </span>
                        ) : cmp.status === "DEFAULTED" ? (
                          <span className="px-2 py-0.5 rounded bg-floor text-bear border border-rule text-[10px] font-bold">
                            🚨 DEFAULTED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-floor text-paper border border-rule text-[10px] font-bold">
                            🟢 ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              setDepositProfitComp(cmp);
                              setDepositProfitAmount("");
                              setDepositProfitNotes("");
                            }}
                            className="px-2.5 py-1 rounded bg-floor hover:bg-amber-500 text-paper hover:text-black border border-rule text-[10px] font-semibold transition cursor-pointer"
                            title="Deposit operating profits into corporate treasury"
                          >
                            💰 Deposit Profit
                          </button>
                          {cmp.status === "HALTED" ? (
                            <button
                              onClick={() => handleSetCompanyStatus(cmp.id, "ACTIVE")}
                              className="px-2.5 py-1 rounded bg-bullion hover:bg-amber-300 text-floor text-[10px] font-semibold transition cursor-pointer"
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
                              className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-800 text-bear border border-rule text-[10px] font-semibold transition cursor-pointer"
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
        <div className="bg-pane/60 border border-rule rounded-[6px] p-5 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-bullion" />
                <h3 className="font-bold text-white text-base">
                  Corporate Earnings & Friday 50% Profit Dividend Desk
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] tabular font-bold bg-floor text-paper border border-rule">
                  WEEKLY UTC 00:00 PAYOUT
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Audit weekly net profits, declare 50% profit distributions, and automatically sweep dividend gold into shareholder purses every Friday at 00:00 UTC.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-floor px-3 py-1.5 rounded-[6px] border border-rule text-right tabular text-xs">
                <span className="text-[10px] text-zinc-400 block font-sans uppercase">Next Friday Payout</span>
                <span className="text-bullion font-bold">
                  {nextFriday ? new Date(nextFriday).toUTCString().slice(0, 22) : "Calculating..."}
                </span>
              </div>

              <button
                type="button"
                onClick={handleProcessScheduledDividends}
                disabled={processScheduledLoading}
                className="px-3.5 py-2 rounded-[6px] bg-floor hover:bg-floor border border-rule text-paper font-bold text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-4 h-4 text-bullion" />
                {processScheduledLoading ? "Sweeping Dividends..." : "Force Friday Sweeper"}
              </button>
            </div>
          </div>

          {/* Form to report earnings */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleReportEarnings} className="lg:col-span-5 bg-floor/80 border border-rule rounded-[6px] p-4 flex flex-col gap-3 font-sans text-xs">
              <h4 className="font-bold text-zinc-200 text-sm flex items-center gap-1.5">
                <Award className="w-4 h-4 text-bullion" />
                Declare Corporate Earnings & Dividend
              </h4>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Enterprise / Company
                </label>
                <select
                  value={divCompanyId}
                  onChange={(e) => setDivCompanyId(e.target.value)}
                  className="w-full bg-pane border border-rule rounded-[4px] px-3 py-2 text-white tabular text-xs focus:outline-none focus:border-rule"
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
                    className="w-full bg-pane border border-rule rounded-[4px] px-3 py-1.5 text-white tabular text-xs focus:outline-none focus:border-rule"
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
                    className="w-full bg-pane border border-rule rounded-[4px] px-3 py-1.5 text-white tabular text-xs focus:outline-none focus:border-rule"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-semibold text-zinc-300">
                    Net Audited Profit (gold) *
                  </label>
                  <span className="text-[10px] text-bullion tabular font-bold">
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
                  className="w-full bg-pane border border-rule rounded-[4px] px-3 py-2 text-paper tabular text-sm font-bold focus:outline-none focus:border-rule"
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
                  className="w-full bg-pane border border-rule rounded-[4px] px-3 py-1.5 text-white font-sans text-xs focus:outline-none focus:border-rule"
                />
              </div>

              <div className="p-2.5 bg-pane/90 rounded-[4px] border border-rule flex items-center justify-between">
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
                className="mt-1 w-full py-2.5 rounded-[6px] bg-bullion hover:bg-amber-300 text-floor font-bold text-xs transition cursor-pointer disabled:opacity-50"
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
                <div className="py-12 text-center text-zinc-500 tabular text-xs border border-dashed border-rule rounded-[6px]">
                  No earnings reports logged yet. Submit the audit report on the left to schedule the upcoming Friday distribution.
                </div>
              ) : (
                <div className="overflow-x-auto border border-rule rounded-[6px] bg-floor/60 max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left tabular text-xs">
                    <thead className="sticky top-0 bg-pane">
                      <tr className="text-zinc-400 uppercase text-[10px] tracking-wider border-b border-rule font-sans">
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
                            <td className="py-2.5 px-3 font-bold text-bullion">
                              {Number(r.dividendPool).toFixed(1)}g
                            </td>
                            <td className="py-2.5 px-3 text-paper">
                              {Number(r.dividendPerShare).toFixed(4)}g
                            </td>
                            <td className="py-2.5 px-3">
                              {isPaid ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-floor text-paper border border-rule font-sans">
                                  PAID OUT
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-floor text-bullion border border-rule font-sans animate-pulse">
                                  SCHEDULED
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {!isPaid && (
                                <button
                                  type="button"
                                  onClick={() => handleDistributeNow(r.id)}
                                  className="px-2 py-1 rounded bg-bullion hover:bg-amber-300 text-floor text-[10px] font-bold font-sans transition cursor-pointer"
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
          const totalTradingValue = citizens.reduce((sum, c) => sum + (Number(c.trading_value) || 0), 0);
          const totalNetWorth = citizens.reduce((sum, c) => sum + (Number(c.total_net_worth) || ((Number(c.cash_balance) || 0) + (Number(c.locked_cash) || 0) + (Number(c.trading_value) || 0))), 0);

          const filteredCitizens = citizens.filter((c) => {
            if (citizenFilter === "WEALTHY" && ((Number(c.cash_balance) || 0) <= 0 && (!c.trading_value || c.trading_value <= 0))) return false;
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
            <div className="bg-pane/40 border border-rule rounded-[6px] overflow-hidden flex flex-col gap-5 p-5">
              {/* Header and Title */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rule pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-bullion" />
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      Citizen Wealth Inspector
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] tabular font-bold bg-floor text-paper border border-rule">
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
                    className="px-3 py-1.5 rounded-[6px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-rule text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                    Refresh Balances
                  </button>
                </div>
              </div>

              {/* Platform-Wide Wealth Aggregates */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-3 bg-floor/80 border border-rule rounded-[6px]">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-zinc-400">
                    <Users className="w-3.5 h-3.5 text-paper" />
                    <span>Registered Accounts</span>
                  </div>
                  <div className="tabular text-lg font-black text-white mt-1">
                    {citizens.length}
                  </div>
                  <div className="text-[10px] text-zinc-500 tabular mt-0.5">
                    Individual Player Purses
                  </div>
                </div>

                <div className="p-3 bg-floor/80 border border-rule rounded-[6px]">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-paper">
                    <Coins className="w-3.5 h-3.5 text-paper" />
                    <span>Purse Gold (Cash)</span>
                  </div>
                  <div className="tabular text-lg font-black text-paper mt-1">
                    {totalPurseCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                  </div>
                  <div className="text-[10px] text-zinc-500 tabular mt-0.5">
                    Available in player purses
                  </div>
                </div>

                <div className="p-3 bg-floor/80 border border-rule rounded-[6px]">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-bullion">
                    <Clock className="w-3.5 h-3.5 text-bullion" />
                    <span>Locked in Orders</span>
                  </div>
                  <div className="tabular text-lg font-black text-bullion mt-1">
                    {totalLockedCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                  </div>
                  <div className="text-[10px] text-zinc-500 tabular mt-0.5">
                    Committed in active limit bids
                  </div>
                </div>

                <div className="p-3 bg-floor/80 border border-rule rounded-[6px]">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-paper">
                    <TrendingUp className="w-3.5 h-3.5 text-paper" />
                    <span>Circulating Stock Holdings</span>
                  </div>
                  <div className="tabular text-lg font-black text-paper mt-1">
                    {totalTradingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                  </div>
                  <div className="text-[10px] text-zinc-500 tabular mt-0.5">
                    Traded secondary citizen shares
                  </div>
                </div>

                <div className="p-3 bg-floor border border-rule rounded-[6px] col-span-2 sm:col-span-1">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-paper">
                    <Award className="w-3.5 h-3.5 text-bullion" />
                    <span>Total Platform Capital</span>
                  </div>
                  <div className="tabular text-lg font-black text-bullion mt-1">
                    {totalNetWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                  </div>
                  <div className="text-[10px] text-zinc-400 tabular mt-0.5">
                    Cash + Locked + Traded Stocks
                  </div>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-floor/60 p-3 rounded-[6px] border border-rule">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={citizenSearch}
                    onChange={(e) => setCitizenSearch(e.target.value)}
                    placeholder="Search by username, display name, realm title, or stock holding (e.g. GUG)..."
                    className="w-full bg-pane border border-rule rounded-[4px] pl-9 pr-8 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rule font-sans"
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
                    className={`px-2.5 py-1 rounded-[4px] text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
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
                    className={`px-2.5 py-1 rounded-[4px] text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
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
                    className={`px-2.5 py-1 rounded-[4px] text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
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
              <div className="overflow-x-auto border border-rule rounded-[6px] bg-floor/40">
                <table className="w-full text-left tabular text-xs">
                  <thead>
                    <tr className="bg-pane/90 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-rule font-sans">
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
                        const tradingVal = Number(c.trading_value || 0);
                        const netWorth = Number(c.total_net_worth !== undefined ? c.total_net_worth : (purseCash + lockedCash + tradingVal));
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
                                      <span className="px-1.5 py-0.2 rounded text-[9px] tabular font-bold bg-floor text-paper border border-rule">
                                        🛡️ ADMIN
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="text-[10px] text-zinc-400 font-sans flex items-center gap-1.5 mt-0.5">
                                    <span className="tabular text-zinc-300">@{c.username}</span>
                                    {c.parlamentum_name && c.parlamentum_name !== c.username && (
                                      <span className="text-zinc-500">· Game: {c.parlamentum_name}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3 text-[11px] font-sans whitespace-nowrap">
                              {c.is_admin ? (
                                <span className="px-2 py-0.5 rounded bg-floor text-paper border border-rule font-bold whitespace-nowrap inline-flex items-center gap-1">
                                  🛡️ Operator
                                </span>
                              ) : (
                                <span className="text-zinc-400 whitespace-nowrap inline-flex items-center gap-1">
                                  👤 Citizen
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="tabular font-black text-paper text-sm">
                                {purseCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                              </div>
                              <div className="text-[10px] text-zinc-500 font-sans">
                                Personal Purse
                              </div>
                              {c.founder_companies && c.founder_companies.length > 0 && (
                                <div className="mt-1 pt-1 border-t border-rule space-y-0.5">
                                  {c.founder_companies.map((fc: any) => (
                                    <div key={fc.id} className="text-[10px] tabular text-paper font-bold">
                                      🏢 ${fc.ticker}: {Number(fc.treasuryBalance || 0).toFixed(2)}g
                                    </div>
                                  ))}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setAdjustingCitizen(c);
                                  setAdjustBalanceValue(String(purseCash));
                                  setAdjustReason(`Operator purse adjustment for @${c.username}`);
                                }}
                                className="text-[10px] font-sans text-bullion/80 hover:text-paper underline cursor-pointer mt-1 block ml-auto"
                                title="Adjust this citizen's purse balance"
                              >
                                Adjust Purse
                              </button>
                            </td>

                            <td className="py-3 px-3 text-right tabular text-zinc-400 whitespace-nowrap">
                              {lockedCash > 0 ? (
                                <span className="text-paper font-semibold">
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
                                      className={`px-2 py-0.5 rounded text-[10px] tabular whitespace-nowrap inline-flex items-center gap-1 ${
                                        h.isCreator
                                          ? "bg-floor border border-rule text-paper"
                                          : "bg-floor border border-rule text-paper"
                                      }`}
                                      title={`${h.isCreator ? "👑 Founder Stake: " : ""}${h.companyName} (${h.totalShares.toLocaleString()} shares @ ${h.currentPrice.toFixed(2)}g)`}
                                    >
                                      {h.isCreator ? <span>👑</span> : null}
                                      <b className={h.isCreator ? "text-paper" : "text-bullion"}>${h.ticker}</b>: {h.totalShares.toLocaleString()} sh
                                      <span className="text-zinc-400">({h.holdingValue.toFixed(1)}g)</span>
                                    </span>
                                  ))}
                                  <div className="w-full text-[10px] text-zinc-400 tabular mt-0.5">
                                    {c.founder_value && c.founder_value > 0 ? (
                                      <span>
                                        Circulating Holdings: <b className="text-paper font-bold">{tradingVal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}g</b>
                                        <span className="text-zinc-500 ml-1">
                                          · 👑 Company Stock: {(c.founder_value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}g (Excluded from Capital)
                                        </span>
                                      </span>
                                    ) : (
                                      <span>Holdings Valuation: {tradingVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right">
                              <div className="tabular font-black text-bullion text-sm">
                                {netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}g
                              </div>
                              <div className="text-[9px] text-zinc-500 tabular">
                                Total Platform Capital
                              </div>
                            </td>

                            <td className="py-3 px-3 text-center text-[11px] font-sans">
                              {Number(c.is_frozen || 0) === 1 ? (
                                <span className="px-2 py-0.5 rounded bg-floor text-bear border border-rule font-bold">
                                  ❄️ FROZEN
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-floor text-paper font-medium">
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
                                  className="px-2 py-1 rounded bg-floor hover:bg-floor text-paper border border-rule text-[10px] font-medium transition cursor-pointer"
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
                                <button
                                  type="button"
                                  onClick={() => handleResetCode(c.id, c.username)}
                                  className="px-2 py-1 rounded bg-pane hover:bg-rule text-paper border border-rule text-[10px] transition cursor-pointer"
                                  title="Make a one-time password reset code"
                                >
                                  Reset code
                                </button>
                                {Number(c.is_frozen || 0) === 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleFreezeUser(c.id, false)}
                                    className="px-2 py-1 rounded bg-bullion hover:bg-amber-300 text-floor text-[10px] font-semibold transition cursor-pointer"
                                    title="Unfreeze Account"
                                  >
                                    Unfreeze
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleFreezeUser(c.id, true)}
                                    className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-800 text-bear border border-rule text-[10px] font-semibold transition cursor-pointer"
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
            <div className="bg-pane border border-rule rounded-[6px] max-w-md w-full p-6 relative">
              <button
                type="button"
                onClick={() => setAdjustingCitizen(null)}
                className="absolute right-4 top-4 text-zinc-400 hover:text-white p-1 rounded-[4px] hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-[6px] bg-floor border border-rule flex items-center justify-center text-xl">
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
                <div className="p-3 bg-floor rounded-[6px] border border-rule flex items-center justify-between tabular">
                  <span className="text-zinc-400">Current Purse Balance:</span>
                  <span className="text-paper font-bold text-sm">
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
                    className="w-full bg-floor border border-rule rounded-[4px] px-3 py-2 text-white tabular text-base font-bold focus:outline-none focus:border-rule"
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
                        className="py-1 text-[10px] tabular bg-zinc-800 hover:bg-zinc-700 rounded text-paper transition cursor-pointer"
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
                    className="w-full bg-floor border border-rule rounded-[4px] px-3 py-2 text-white font-sans text-xs focus:outline-none focus:border-rule"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustingCitizen(null)}
                    className="px-4 py-2 rounded-[6px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adjustLoading}
                    className="px-5 py-2 rounded-[6px] bg-bullion hover:bg-amber-300 text-floor font-bold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {adjustLoading ? "Saving Balance..." : "Save Purse Balance"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Deposit Corporate Operating Profit */}
        {depositProfitComp && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-pane border border-rule rounded-[6px] max-w-md w-full p-6 relative">
              <button
                type="button"
                onClick={() => setDepositProfitComp(null)}
                className="absolute right-4 top-4 text-zinc-400 hover:text-white p-1 rounded-[4px] hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-[6px] bg-floor border border-rule flex items-center justify-center text-xl">
                  🏛️
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Deposit Corporate Profit
                  </h3>
                  <p className="text-zinc-400 text-xs tabular">
                    ${depositProfitComp.ticker} · {depositProfitComp.name}
                  </p>
                </div>
              </div>

              <form onSubmit={handleDepositProfitSubmit} className="space-y-4 text-xs font-sans">
                <div className="p-3 bg-floor rounded-[6px] border border-rule flex items-center justify-between tabular">
                  <span className="text-zinc-400">Current Corporate Treasury:</span>
                  <span className="text-bullion font-bold text-sm">
                    {Number(depositProfitComp.treasuryBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gold
                  </span>
                </div>

                <div>
                  <label className="font-semibold text-zinc-300 block mb-1">
                    Operating Profit Amount (Gold)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 500"
                    value={depositProfitAmount}
                    onChange={(e) => setDepositProfitAmount(e.target.value)}
                    className="w-full bg-floor border border-rule rounded-[4px] px-3 py-2 text-white tabular text-base font-bold focus:outline-none focus:border-rule"
                  />

                  {/* Quick Preset Buttons */}
                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {[100, 250, 500, 1000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setDepositProfitAmount(amt.toString())}
                        className="py-1 text-[10px] tabular bg-zinc-800 hover:bg-zinc-700 rounded text-paper transition cursor-pointer"
                      >
                        +{amt}g
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-zinc-300 block mb-1">
                    Funding Source
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDepositProfitSource("DIRECT")}
                      className={`p-2.5 rounded-[6px] border text-left transition cursor-pointer ${
                        depositProfitSource === "DIRECT"
                          ? "bg-floor border-rule text-white font-bold"
                          : "bg-floor border-rule text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <div className="text-[11px] font-semibold text-paper">Direct In-Game / Gross</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">Does not debit personal purse</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDepositProfitSource("WALLET")}
                      className={`p-2.5 rounded-[6px] border text-left transition cursor-pointer ${
                        depositProfitSource === "WALLET"
                          ? "bg-floor border-rule text-white font-bold"
                          : "bg-floor border-rule text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <div className="text-[11px] font-semibold text-paper">From Personal Wallet</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">Deducts from user gold</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-zinc-300 block mb-1">
                    Description / Accounting Note
                  </label>
                  <input
                    type="text"
                    value={depositProfitNotes}
                    onChange={(e) => setDepositProfitNotes(e.target.value)}
                    placeholder="e.g. Weekly net factory profits & in-game sales"
                    className="w-full bg-floor border border-rule rounded-[4px] px-3 py-2 text-white font-sans text-xs focus:outline-none focus:border-rule"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDepositProfitComp(null)}
                    className="px-4 py-2 rounded-[6px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingProfit}
                    className="px-5 py-2 rounded-[6px] bg-bullion hover:bg-amber-300 text-floor font-bold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {submittingProfit ? "Crediting Treasury..." : "💰 Credit Corporate Treasury"}
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
