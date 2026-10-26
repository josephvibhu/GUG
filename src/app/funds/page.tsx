import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ShieldCheck, Coins, Landmark, TrendingUp, Layers } from "lucide-react";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Managed Funds Desk — Grow Ur Gold",
  description: "Invest in professionally managed funds and sector baskets on Grow Ur Gold, featuring the Bank of Milan Fund (BOMF).",
};

const UPCOMING_FUNDS = [
  {
    ticker: "GUG-Gurantee",
    name: "GUG-Gurantee Fund",
    category: "Capital protection",
    holdings: ["Operator vault reserve, 60%", "Tier-1 tool foundries, 40%"],
    targetYield: "7.5% weekly guaranteed",
    minimumEntry: "25 gold",
    description:
      "Underwritten by the operator's treasury, with weekly payouts whatever the realm markets or wars do. For cautious citizens who want their gold safe.",
  },
  {
    ticker: "GUG-Luck",
    name: "GUG-Luck High-Roller Trust",
    category: "Speculative",
    holdings: ["Deep-mine prospectors, 50%", "Frontier caravans, 30%", "Speculative startups, 20%"],
    targetYield: "0–35% jackpot yield",
    minimumEntry: "50 gold",
    description: "Backs high-variance expeditions and mineral finds. When one strikes, holders share the Friday jackpot.",
  },
  {
    ticker: "GUG-WarBased",
    name: "GUG-WarBased Logistics Fund",
    category: "Military industry",
    holdings: ["Weaponsmith forges, 45%", "Iron armor foundries, 35%", "Warship shipyards, 20%"],
    targetYield: "15–25% conflict yield",
    minimumEntry: "100 gold",
    description: "Holds arms makers, armor smelters and war fleets. As nations go to war, munitions demand and the fund's dividends rise.",
  },
];

export default function FundsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-8">
        <Link href="/" className="self-start text-[13px] text-ash hover:text-paper flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Markets
        </Link>

        <header className="flex flex-col gap-2 max-w-[70ch]">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-bullion/20 text-bullion border border-bullion/40">
              OFFICIAL FUNDS DESK
            </span>
            <span className="text-[12px] text-ash">Managed Unit Trusts</span>
          </div>
          <h1 className="condensed text-[34px] sm:text-[40px] leading-none font-extrabold text-zinc-50 tracking-tight">
            Managed Funds & Unit Trusts
          </h1>
          <p className="text-[14px] sm:text-[15px] text-paper leading-relaxed">
            Own a share of an entire diversified portfolio rather than single stocks. Funds pool capital across loans, equities, and physical commodity operations, distributing weekly net profits directly to unit holders.
          </p>
        </header>

        {/* Featured Flagship: Bank of Milan Fund (BOMF) */}
        <section aria-labelledby="flagship-fund" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 id="flagship-fund" className="text-[14px] uppercase tracking-wider font-semibold text-zinc-400 font-sans flex items-center gap-2">
              <Landmark className="h-4 w-4 text-bullion" />
              Flagship Certified Fund
            </h2>
            <span className="text-[12px] text-bullion font-semibold animate-pulse">
              ● Pre-Release Live
            </span>
          </div>

          <div className="border border-bullion/40 bg-floor/60 rounded-[6px] p-5 sm:p-6 flex flex-col gap-6 shadow-[0_8px_30px_rgba(217,119,6,0.08)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-5">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-[6px] bg-pane border border-rule flex items-center justify-center text-2xl shrink-0">
                  🏦
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="condensed text-[26px] font-extrabold text-zinc-50 leading-none">BOMF</span>
                    <span className="text-[16px] text-paper font-semibold">Bank of Milan Fund</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-floor text-ash border border-rule">
                      Managed by Timerton
                    </span>
                  </div>
                  <p className="text-[13px] text-ash mt-1 max-w-2xl leading-relaxed">
                    A bank-managed unit fund investing across high-yield merchant loans, listed equities, and commodity processing, with physical gold reserves. 50% weekly net profit paid every Friday.
                  </p>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                <span className="text-[11px] text-ash uppercase font-sans">Pre-Release Price</span>
                <span className="condensed text-[24px] font-bold text-bullion leading-none">1.00 gold</span>
                <span className="text-[11px] text-ash">(Lists at 5.00g on Fri 30 Oct)</span>
              </div>
            </div>

            {/* Key Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
              <div className="bg-pane/40 border border-rule rounded-[4px] p-3 flex flex-col gap-1">
                <span className="text-ash flex items-center gap-1">
                  <Coins className="h-3 w-3 text-bullion" /> Weekly Dividend
                </span>
                <span className="text-[15px] font-bold text-zinc-50">50% Net Profit</span>
                <span className="text-[10px] text-ash">Every Friday at 00:00 UTC</span>
              </div>

              <div className="bg-pane/40 border border-rule rounded-[4px] p-3 flex flex-col gap-1">
                <span className="text-ash flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-bull" /> Seed Capital
                </span>
                <span className="text-[15px] font-bold text-zinc-50">100 gold stake</span>
                <span className="text-[10px] text-ash">Locked for 60 days</span>
              </div>

              <div className="bg-pane/40 border border-rule rounded-[4px] p-3 flex flex-col gap-1">
                <span className="text-ash flex items-center gap-1">
                  <Layers className="h-3 w-3 text-paper" /> Pre-Release Cap
                </span>
                <span className="text-[15px] font-bold text-zinc-50">1,000 units</span>
                <span className="text-[10px] text-ash">26–30 Oct 2026 UTC</span>
              </div>

              <div className="bg-pane/40 border border-rule rounded-[4px] p-3 flex flex-col gap-1">
                <span className="text-ash flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-bullion" /> Exit / Redemption
                </span>
                <span className="text-[15px] font-bold text-zinc-50">At NAV (4w lock)</span>
                <span className="text-[10px] text-ash">Or sell on GUG bourse</span>
              </div>
            </div>

            {/* Target Asset Allocation */}
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-semibold text-paper">Target Portfolio Allocation:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
                <div className="px-3 py-2 rounded-[4px] bg-pane/30 border border-rule flex justify-between items-center">
                  <span className="text-ash">Merchant Loans</span>
                  <span className="text-zinc-50 font-bold">up to 40%</span>
                </div>
                <div className="px-3 py-2 rounded-[4px] bg-pane/30 border border-rule flex justify-between items-center">
                  <span className="text-ash">Exchange Stocks</span>
                  <span className="text-zinc-50 font-bold">up to 25%</span>
                </div>
                <div className="px-3 py-2 rounded-[4px] bg-pane/30 border border-rule flex justify-between items-center">
                  <span className="text-ash">Commodities & Iron</span>
                  <span className="text-zinc-50 font-bold">up to 25%</span>
                </div>
                <div className="px-3 py-2 rounded-[4px] bg-pane/30 border border-rule flex justify-between items-center">
                  <span className="text-ash">Gold Cash Reserve</span>
                  <span className="text-zinc-50 font-bold">at least 20%</span>
                </div>
              </div>
            </div>

            {/* Action CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <span className="text-[12px] text-ash">
                Pre-release units are trading on the live exchange order book at 1.00 gold.
              </span>
              <Link
                href="/trade/BOMF"
                className="h-9 px-5 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-bold text-[13px] flex items-center justify-center gap-1.5 transition-colors self-start sm:self-auto"
              >
                Buy BOMF Pre-Release Units (1.00g)
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Upcoming In-House Funds */}
        <section aria-labelledby="upcoming-funds" className="flex flex-col gap-3 mt-4">
          <h2 id="upcoming-funds" className="text-[14px] uppercase tracking-wider font-semibold text-zinc-400 font-sans">
            Upcoming GUG In-House Funds
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {UPCOMING_FUNDS.map((f) => (
              <article key={f.ticker} className="border border-rule rounded-[4px] flex flex-col bg-pane/20">
                <header className="px-4 pt-4 pb-3 flex flex-col gap-1">
                  <span className="text-[11px] text-ash uppercase font-sans">{f.category}</span>
                  <h3 className="condensed text-[22px] font-extrabold text-zinc-50 leading-none">{f.ticker}</h3>
                  <span className="text-[13px] text-paper font-medium">{f.name}</span>
                </header>
                <dl className="px-4 py-3 border-t border-rule grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                  <dt className="text-ash">Target return</dt>
                  <dd className="text-right text-zinc-50 font-semibold">{f.targetYield}</dd>
                  <dt className="text-ash">Minimum entry</dt>
                  <dd className="text-right text-paper">{f.minimumEntry}</dd>
                </dl>
                <p className="px-4 py-3 border-t border-rule text-[12px] text-paper leading-relaxed">{f.description}</p>
                <ul className="mt-auto px-4 py-3 border-t border-rule text-[11px] text-ash flex flex-col gap-0.5">
                  {f.holdings.map((h) => (
                    <li key={h}>• {h}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
