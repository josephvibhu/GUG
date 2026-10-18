"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { 
  TrendingUp, 
  Coins, 
  Briefcase, 
  Building2, 
  PlusCircle, 
  Zap, 
  ChevronDown, 
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
  LogIn,
  LogOut,
  User as UserIcon
} from "lucide-react";
import WalletModal from "./WalletModal";

interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  cashBalance: number;
  lockedCash: number;
  avatar: string;
  isAdmin?: boolean;
  accountType?: "CITIZEN" | "STATE";
  stateRealmName?: string;
  stateCrest?: string;
}

interface CompanyTicker {
  ticker: string;
  currentPrice: number;
  change24h: number;
}

interface MarketSchedule {
  isOpen: boolean;
  statusText: string;
  openTimeStr: string;
  closeTimeStr: string;
  timeRemainingFormatted: string;
  currentIST: string;
}

function NavbarInner({ onUserRefresh }: { onUserRefresh?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [tickers, setTickers] = useState<CompanyTicker[]>([]);
  const [marketSchedule, setMarketSchedule] = useState<MarketSchedule | null>(null);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [walletTab, setWalletTab] = useState<"deposit" | "withdraw" | "history">("deposit");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [pulseLoading, setPulseLoading] = useState(false);

  const fetchUserData = async () => {
    try {
      const res = await fetch("/api/auth", { cache: "no-store" });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error(e);
      setUser(null);
    }
  };

  const fetchTickers = async () => {
    try {
      const res = await fetch("/api/market", { cache: "no-store" });
      const data = await res.json();
      if (data.companies) {
        setTickers(
          data.companies.map((c: any) => ({
            ticker: c.ticker,
            currentPrice: c.currentPrice,
            change24h: c.change24h,
          }))
        );
      }
      if (data.marketSchedule) {
        setMarketSchedule(data.marketSchedule);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUserData();
    fetchTickers();

    const handleSync = () => {
      fetchUserData();
      fetchTickers();
    };

    window.addEventListener("wallet_updated", handleSync);
    window.addEventListener("focus", handleSync);

    const interval = setInterval(() => {
      fetchTickers();
      fetchUserData();
    }, 2500);

    return () => {
      clearInterval(interval);
      window.removeEventListener("wallet_updated", handleSync);
      window.removeEventListener("focus", handleSync);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      setUser(null);
      setIsUserMenuOpen(false);
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePulse = async () => {
    setPulseLoading(true);
    try {
      const res = await fetch("/api/market/pulse", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchTickers();
        fetchUserData();
        if (onUserRefresh) onUserRefresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPulseLoading(false);
    }
  };

  const terminalUrl = tickers.length > 0 ? `/trade/${tickers[0].ticker}` : `/trade`;

  return (
    <header className="border-b border-zinc-800 bg-zinc-950 text-zinc-100 sticky top-0 z-50">
      {/* Ticker Tape */}
      <div className="bg-zinc-900/80 border-b border-zinc-800/80 px-4 py-1.5 text-xs overflow-x-auto scrollbar-none flex items-center gap-6">
        <span className="flex items-center gap-1.5 font-semibold text-amber-400 shrink-0 uppercase tracking-wider text-[11px]">
          <Zap className="w-3.5 h-3.5" /> Grow Ur Gold · Parlamentum
        </span>

        {marketSchedule && (
          <div className="flex items-center gap-2 pl-3 border-l border-zinc-800 text-[11px] font-mono shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${
                marketSchedule.isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span
              className={`font-bold ${
                marketSchedule.isOpen ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {marketSchedule.isOpen ? "FLOOR OPEN" : "FLOOR CLOSED"}
            </span>
            <span className="text-zinc-400 text-[10px] hidden md:inline">
              ({marketSchedule.statusText})
            </span>
          </div>
        )}
        <div className="flex items-center gap-6">
          {tickers.length === 0 ? (
            <span className="text-zinc-400 font-sans text-[11px] italic">
              {marketSchedule?.isOpen ? "Floor Open" : "Floor Closed"} · 0 public charters listed · Apply for charter with{" "}
              <Link href="/ipo" className="text-amber-400 underline font-semibold not-italic">
                Launch IPO
              </Link>
            </span>
          ) : (
            tickers.map((t) => (
              <Link
                key={t.ticker}
                href={`/trade/${t.ticker}`}
                className="flex items-center gap-2 hover:bg-zinc-800 px-2 py-0.5 rounded transition font-mono whitespace-nowrap"
              >
                <span className="font-bold text-zinc-200">${t.ticker}</span>
                <span>{t.currentPrice.toFixed(2)} gold</span>
                <span
                  className={`font-semibold ${
                    t.change24h >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {t.change24h >= 0 ? "+" : ""}
                  {t.change24h.toFixed(2)}%
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-4 sm:gap-8 shrink-0">
          <Link href="/" className="flex items-center gap-2.5 group shrink-0 whitespace-nowrap">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:border-amber-400 transition shrink-0">
              🏛️
            </div>
            <div className="flex flex-col shrink-0">
              <div className="font-bold tracking-tight text-base sm:text-lg flex items-center gap-2 whitespace-nowrap leading-none">
                <span className="whitespace-nowrap font-black">GROW UR GOLD</span>
                <span className="text-[10px] bg-amber-500/15 text-amber-300 font-mono font-bold px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0 uppercase tracking-wide">
                  PARLAMENTUM
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-widest mt-1 whitespace-nowrap">
                Official Stock Exchange
              </div>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                pathname === "/"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              }`}
            >
              <Building2 className="w-4 h-4 text-amber-400" />
              Markets
            </Link>
            <Link
              href={terminalUrl}
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                pathname.startsWith("/trade")
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              }`}
            >
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Terminal
            </Link>
            <Link
              href="/portfolio"
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                pathname === "/portfolio"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              }`}
            >
              <Briefcase className="w-4 h-4 text-blue-400" />
              Portfolio
            </Link>
            <Link
              href="/ipo"
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                pathname === "/ipo"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              }`}
            >
              <PlusCircle className="w-4 h-4 text-purple-400" />
              Launch IPO
            </Link>
            {user?.isAdmin && (
              <Link
                href="/admin"
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                  pathname === "/admin"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Operator Panel
              </Link>
            )}
          </nav>
        </div>

        {/* Right Section: Gold Purse & Citizen Login/Menu */}
        <div className="flex items-center gap-3">
          {/* Bot pulse button if stocks exist */}
          {tickers.length > 0 && (
            <button
              onClick={handlePulse}
              disabled={pulseLoading}
              title="Simulate Market Trading Pulse"
              className="hidden lg:flex items-center gap-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 px-2.5 py-1.5 rounded-md text-zinc-300 font-medium transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${pulseLoading ? "animate-spin" : ""}`} />
              <span>Bot Pulse</span>
            </button>
          )}

          {/* Logged-In User Purse Button */}
          {user ? (
            <div
              onClick={() => {
                setWalletTab("deposit");
                setIsWalletOpen(true);
              }}
              title="Open Parlamentum Raw Iron (5g) Purse"
              className="bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 rounded-xl px-3 py-1.5 flex items-center gap-2.5 cursor-pointer transition select-none group"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-sm group-hover:scale-105 transition">
                <Coins className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                  Purse Gold
                </span>
                <span className="font-mono text-sm font-bold text-emerald-400">
                  {user.cashBalance.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-xs font-sans text-zinc-400">gold</span>
                </span>
              </div>
              <div className="flex flex-col gap-0.5 ml-1 border-l border-zinc-800 pl-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setWalletTab("deposit");
                    setIsWalletOpen(true);
                  }}
                  title="Deposit (Raw Iron @ 5g)"
                  className="p-1 hover:bg-emerald-500/20 text-emerald-400 rounded transition cursor-pointer"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setWalletTab("withdraw");
                    setIsWalletOpen(true);
                  }}
                  title="Withdraw (Tax Negated)"
                  className="p-1 hover:bg-amber-500/20 text-amber-400 rounded transition cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : null}

          {/* Citizen Menu or Login Button */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition cursor-pointer border ${
                  user.accountType === "STATE"
                    ? "bg-purple-950/40 border-purple-500/50 hover:border-purple-400 text-purple-200"
                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-200"
                }`}
              >
                <span className="text-base">{user.accountType === "STATE" ? (user.stateCrest || "🏛️") : (user.avatar || "👤")}</span>
                <span className="font-medium hidden sm:inline max-w-[130px] truncate">
                  {user.accountType === "STATE" ? (user.stateRealmName || user.displayName) : user.displayName}
                </span>
                {user.accountType === "STATE" && (
                  <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1 py-0.2 rounded font-mono font-bold hidden md:inline">
                    STATE
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3.5 py-2.5 border-b border-zinc-800 text-xs">
                    <div className="text-[10px] uppercase font-semibold flex items-center justify-between">
                      <span className={user.accountType === "STATE" ? "text-purple-400 font-bold flex items-center gap-1" : "text-zinc-400"}>
                        {user.accountType === "STATE" ? "👑 Sovereign State Treasury" : "Active Citizen"}
                      </span>
                      {user.accountType === "STATE" && (
                        <span className="text-[9px] font-mono text-purple-300 bg-purple-950 px-1 py-0.5 rounded border border-purple-500/40">
                          {user.stateCrest || "🏛️"} State
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-white text-sm truncate mt-0.5 flex items-center gap-1.5">
                      <span>{user.accountType === "STATE" ? (user.stateRealmName || user.displayName) : user.displayName}</span>
                      {user.isAdmin && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">
                          Operator
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-zinc-400">
                      {user.accountType === "STATE" ? `Delegate / Handle: @${user.username}` : `In-Game: ${user.username}`}
                    </div>
                    <div className="mt-1.5 font-mono text-emerald-400 font-bold text-xs bg-zinc-950 p-1.5 rounded border border-zinc-800 flex justify-between">
                      <span className="text-zinc-400 font-sans font-normal">Purse:</span>
                      <span>{user.cashBalance.toLocaleString()} gold</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setWalletTab("deposit");
                        setIsWalletOpen(true);
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-200 cursor-pointer"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                      Deposit Gold (Raw Iron @ 5g)
                    </button>
                    <button
                      onClick={() => {
                        setWalletTab("withdraw");
                        setIsWalletOpen(true);
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-200 cursor-pointer"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                      Withdraw Gold (Tax Negated)
                    </button>
                    <Link
                      href="/portfolio"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full text-left px-3.5 py-2 text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-200 cursor-pointer"
                    >
                      <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                      Share Portfolio
                    </Link>
                    {user.isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="w-full text-left px-3.5 py-2 text-xs hover:bg-zinc-800 flex items-center gap-2 text-amber-300 font-semibold cursor-pointer"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                        Operator Control Panel
                      </Link>
                    )}
                  </div>

                  <div className="border-t border-zinc-800 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3.5 py-2 text-xs hover:bg-rose-950/40 text-rose-400 flex items-center gap-2 cursor-pointer transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Log Out Citizen
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                Log In / Register
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Parlamentum Wallet Modal */}
      <WalletModal
        isOpen={isWalletOpen}
        initialTab={walletTab}
        onClose={() => setIsWalletOpen(false)}
        onBalanceUpdated={() => {
          fetchUserData();
          if (onUserRefresh) onUserRefresh();
        }}
      />
    </header>
  );
}

export default function Navbar({ onUserRefresh }: { onUserRefresh?: () => void }) {
  return (
    <Suspense
      fallback={
        <header className="border-b border-zinc-800 bg-zinc-950 text-zinc-100 sticky top-0 z-50 h-24 flex items-center px-6">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
            <span className="animate-pulse">Loading exchange ticker tape...</span>
          </div>
        </header>
      }
    >
      <NavbarInner onUserRefresh={onUserRefresh} />
    </Suspense>
  );
}
