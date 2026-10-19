"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import {
  ChartCandlestick,
  ChartNoAxesColumn,
  Briefcase,
  CirclePlus,
  ShieldCheck,
  ChevronDown,
  LogIn,
  LogOut,
  ArrowDownToLine,
  ArrowUpFromLine,
  Bot,
  Coins,
  Landmark,
} from "lucide-react";
import WalletModal from "./WalletModal";
import TermsModal from "./TermsModal";
import DepositAdjustmentModal, { RECALIBRATED_CITIZENS } from "./DepositAdjustmentModal";
import { FloorClock } from "./FloorClock";
import { CoinMark } from "./CoinMark";
import { useMarketFeed, refreshMarketFeed } from "@/hooks/useMarketFeed";
import { fmtGold } from "@/lib/format";

function NavbarInner({ onUserRefresh }: { onUserRefresh?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, schedule, clockOffset, companies } = useMarketFeed();
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [walletTab, setWalletTab] = useState<"deposit" | "withdraw" | "history">("deposit");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pulseNote, setPulseNote] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the account menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const openWallet = (tab: "deposit" | "withdraw") => {
    setWalletTab(tab);
    setIsWalletOpen(true);
    setMenuOpen(false);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
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

  // Operator tool: asks the bot account to place a round of orders
  const handlePulse = async () => {
    setMenuOpen(false);
    try {
      const res = await fetch("/api/market/pulse", { method: "POST" });
      const data = await res.json();
      setPulseNote(data.success ? `Bot round sent (${data.actions?.length || 0} orders)` : data.message || "Bot round failed");
      window.dispatchEvent(new Event("wallet_updated"));
    } catch {
      setPulseNote("Bot round failed");
    }
    setTimeout(() => setPulseNote(null), 4000);
  };

  const tradeHref = pathname.startsWith("/trade/") ? pathname : companies.length > 0 ? `/trade/${companies[0].ticker}` : "/trade";
  const links = [
    { href: "/", label: "Markets", icon: ChartNoAxesColumn, active: pathname === "/" },
    { href: tradeHref, label: "Trade", icon: ChartCandlestick, active: pathname.startsWith("/trade") },
    { href: "/portfolio", label: "Portfolio", icon: Briefcase, active: pathname === "/portfolio" },
    { href: "/ipo", label: "List a company", short: "List", icon: CirclePlus, active: pathname === "/ipo" },
    { href: "/crypto", label: "Crypto", icon: Coins, active: pathname === "/crypto", badge: "SOON" },
    { href: "/funds", label: "Mutual Funds", short: "Funds", icon: Landmark, active: pathname === "/funds", badge: "SOON" },
  ];
  const name = user ? (user.displayName || user.username) : "";

  return (
    <>
      <header className="sticky top-0 z-40 h-12 border-b border-rule bg-floor">
        <div className="h-full px-3 sm:px-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="Grow Ur Gold, markets">
            <CoinMark />
            <span className="condensed text-[17px] font-extrabold tracking-tight text-zinc-50 leading-none">Grow Ur Gold</span>
          </Link>

          <nav className="hidden lg:flex items-stretch h-full ml-2" aria-label="Main">
            {links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                aria-current={l.active ? "page" : undefined}
                className={`px-3 flex items-center gap-1.5 text-[13px] border-b-2 transition-colors ${
                  l.active ? "text-zinc-50 border-zinc-50" : "text-ash border-transparent hover:text-paper"
                }`}
              >
                <span>{l.label}</span>
                {l.badge && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 leading-none">
                    {l.badge}
                  </span>
                )}
              </Link>
            ))}
            {user?.isAdmin && (
              <Link
                href="/admin"
                aria-current={pathname === "/admin" ? "page" : undefined}
                className={`px-3 flex items-center gap-1.5 text-[13px] border-b-2 transition-colors ${
                  pathname === "/admin" ? "text-zinc-50 border-zinc-50" : "text-ash border-transparent hover:text-paper"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Operator
              </Link>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <FloorClock schedule={schedule} clockOffset={clockOffset} />

            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => openWallet("deposit")}
                  title="Your purse: deposit or withdraw gold"
                  className="h-8 px-2.5 rounded-[4px] border border-rule hover:border-zinc-600 flex items-center gap-1.5 transition-colors"
                >
                  <CoinMark className="h-3.5 w-3.5" />
                  <span className="text-[13px] font-semibold text-bullion">{fmtGold(user.cashBalance)}</span>
                  <span className="text-[11px] text-ash hidden sm:inline">gold</span>
                </button>

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className="h-8 pl-1.5 pr-2 rounded-[4px] hover:bg-pane flex items-center gap-1.5 text-[13px] text-paper"
                  >
                    <span className="h-6 w-6 rounded-full bg-pane border border-rule flex items-center justify-center text-[13px] leading-none">
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="hidden lg:inline max-w-[140px] truncate">{name}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-ash" />
                  </button>

                  {menuOpen && (
                    <div role="menu" className="absolute right-0 mt-1.5 w-60 rounded-[4px] border border-rule bg-pane shadow-[0_8px_24px_rgba(0,0,0,0.45)] py-1 text-[13px]">
                      <div className="px-3 py-2 border-b border-rule">
                        <div className="text-zinc-50 font-semibold truncate">{name}</div>
                        <div className="text-[12px] text-ash truncate">
                          In game as {user.parlamentumName || user.username}
                        </div>
                      </div>
                      <button role="menuitem" onClick={() => openWallet("deposit")} className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-rule/60">
                        <ArrowDownToLine className="h-4 w-4 text-ash" /> Deposit gold
                      </button>
                      <button role="menuitem" onClick={() => openWallet("withdraw")} className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-rule/60">
                        <ArrowUpFromLine className="h-4 w-4 text-ash" /> Withdraw gold
                      </button>
                      <Link role="menuitem" href="/portfolio" onClick={() => setMenuOpen(false)} className="px-3 py-2 flex items-center gap-2 hover:bg-rule/60">
                        <Briefcase className="h-4 w-4 text-ash" /> Portfolio
                      </Link>
                      {user.isAdmin && (
                        <>
                          <Link role="menuitem" href="/admin" onClick={() => setMenuOpen(false)} className="px-3 py-2 flex items-center gap-2 hover:bg-rule/60">
                            <ShieldCheck className="h-4 w-4 text-ash" /> Operator panel
                          </Link>
                          <button role="menuitem" onClick={handlePulse} className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-rule/60">
                            <Bot className="h-4 w-4 text-ash" /> Run a bot trading round
                          </button>
                        </>
                      )}
                      <div className="border-t border-rule mt-1 pt-1">
                        <button role="menuitem" onClick={handleLogout} className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-rule/60">
                          <LogOut className="h-4 w-4 text-ash" /> Log out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="h-8 px-3 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor text-[13px] font-semibold flex items-center gap-1.5 transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Log in
              </Link>
            )}
          </div>
        </div>
        {pulseNote && (
          <div role="status" className="absolute right-3 top-full mt-2 rounded-[4px] border border-rule bg-pane px-3 py-2 text-[12px] text-paper">
            {pulseNote}
          </div>
        )}
      </header>

      {/* Phones: the main sections as a bottom tab bar (the header has no room for them) */}
      <nav className="mobile-tabbar md:hidden fixed bottom-0 inset-x-0 z-40 h-14 border-t border-rule bg-floor grid grid-cols-4" aria-label="Main">
        {links.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            aria-current={l.active ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] ${l.active ? "text-zinc-50" : "text-ash"}`}
          >
            <l.icon className="h-5 w-5" />
            {l.short || l.label}
          </Link>
        ))}
      </nav>

      {/* Mounted per opening so "Withdraw gold" really opens the withdraw tab (the tab used to stick) */}
      {isWalletOpen && (
        <WalletModal
          key={walletTab}
          isOpen
          initialTab={walletTab}
          onClose={() => setIsWalletOpen(false)}
          onBalanceUpdated={() => {
            refreshMarketFeed();
            if (onUserRefresh) onUserRefresh();
          }}
        />
      )}

      {/* Mandatory Terms & Conditions modal for users who have not yet accepted */}
      <TermsModal isOpen={Boolean(user && user.termsAccepted === false)} />

      {/* Recalibration & Apology Notice modal for affected citizens */}
      <DepositAdjustmentModal
        isOpen={Boolean(user && user.termsAccepted !== false && !user.adjustmentNoticeSeen && RECALIBRATED_CITIZENS[user.id])}
        user={user}
      />
    </>
  );
}

export default function Navbar({ onUserRefresh }: { onUserRefresh?: () => void }) {
  return (
    <Suspense fallback={<header className="sticky top-0 z-40 h-12 border-b border-rule bg-floor" />}>
      <NavbarInner onUserRefresh={onUserRefresh} />
    </Suspense>
  );
}
