import Link from "next/link";
import Navbar from "@/components/Navbar";
import { 
  Landmark, 
  Sparkles, 
  ShieldAlert, 
  ArrowLeft, 
  PieChart, 
  TrendingUp, 
  ShieldCheck, 
  Percent, 
  Briefcase, 
  Clock, 
  CheckCircle2, 
  Users 
} from "lucide-react";

export const metadata = {
  title: "Mutual Funds & Indexes (Coming Soon) — Grow Ur Gold",
  description: "Season 2 preview: Diversified syndicate funds, industry indexes, and automated Friday dividend trusts on Grow Ur Gold.",
};

const UPCOMING_FUNDS = [
  {
    ticker: "HISF",
    name: "Heavy Industry Syndicate Fund",
    category: "Sector Index",
    objective: "Capital Growth & Tooling Reserves",
    holdings: ["Mines (40%)", "Foundries (35%)", "Toolmakers (25%)"],
    targetYield: "8.5% weekly",
    minimumEntry: "50 gold",
    color: "from-amber-500/20 to-stone-500/20 text-amber-400 border-amber-500/30",
    description: "Bundles top iron mines, tool workshops, and foundries into a single liquid ticket. Ideal for citizens wanting exposure to heavy realm production without picking individual companies.",
  },
  {
    ticker: "FAT",
    name: "Food & Agriculture Trust",
    category: "Commodity Index",
    objective: "Consistent Breadbasket Yield",
    holdings: ["Wheat Farms (50%)", "Bakeries (30%)", "Millers (20%)"],
    targetYield: "11.2% weekly",
    minimumEntry: "25 gold",
    color: "from-emerald-500/20 to-lime-500/20 text-emerald-400 border-emerald-500/30",
    description: "Invests in breadbasket grain producers and bakeries feeding active realm populations. Produces dependable cash flow regardless of war cycles.",
  },
  {
    ticker: "PHYD",
    name: "Parlamentum High-Yield Dividend Fund",
    category: "Dividend Focus",
    objective: "Maximized Friday Payouts",
    holdings: ["Top 5 Dividend Equities (Weighted)"],
    targetYield: "14.8% weekly",
    minimumEntry: "100 gold",
    color: "from-cyan-500/20 to-teal-500/20 text-cyan-400 border-cyan-500/30",
    description: "Continuously aggregates the highest weekly dividend payers on Grow Ur Gold. Every Friday at market close, collective gold dividends are split pro-rata to fund unit holders.",
  },
  {
    ticker: "FMCS",
    name: "Founders & Merchant Syndicate Fund",
    category: "Guild Managed",
    objective: "Balanced Blue-Chip Growth",
    holdings: ["Tier-1 Sovereign Companies", "Liquid Vault Reserves"],
    targetYield: "9.0% weekly",
    minimumEntry: "200 gold",
    color: "from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30",
    description: "Governed by veteran merchant houses with verified company accounting ledgers. Maintains conservative reserves and low risk exposure across multiple sovereign borders.",
  },
];

export default function FundsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500 selection:text-black">
      <Navbar />

      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-10">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-ash hover:text-white transition px-2.5 py-1 rounded bg-pane border border-rule"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Equities
          </Link>
        </div>

        {/* Hero Section */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Season 2 Expansion
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
              <Clock className="w-3 h-3 text-amber-400" /> Coming Soon
            </span>
          </div>

          <h1 className="condensed text-3xl sm:text-5xl font-extrabold text-zinc-50 tracking-tight leading-none mt-1">
            Mutual Funds & Syndicate Trusts
          </h1>
          <p className="text-sm sm:text-base text-ash max-w-2xl leading-relaxed">
            One-click diversification across dozens of player businesses. Reduce single-company risk and automate your weekly Friday dividend income.
          </p>
        </div>

        {/* Notice Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3 text-xs text-amber-200/90">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="leading-snug">
            <strong className="text-amber-300">In-Game Rule:</strong> Played with Parlamentum gold only. No real money goes in or comes out. Not run by the Parlamentum team.
          </div>
        </div>

        {/* Preview Funds Grid */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-cyan-400" />
              Upcoming Funds in Pipeline
            </h2>
            <span className="text-xs text-ash">Q4 2026 Launch Window</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {UPCOMING_FUNDS.map((fund) => (
              <div
                key={fund.ticker}
                className="bg-pane/50 border border-rule hover:border-zinc-700 rounded-2xl p-5 flex flex-col justify-between gap-4 transition shadow-lg"
              >
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${fund.color} flex items-center justify-center font-mono font-extrabold text-sm`}>
                        {fund.ticker}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-base text-zinc-100">{fund.ticker}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {fund.category}
                          </span>
                        </div>
                        <span className="text-xs text-ash">{fund.name}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-zinc-500 block">Est. Yield</span>
                      <span className="font-mono font-bold text-xs text-emerald-400">{fund.targetYield}</span>
                    </div>
                  </div>

                  <p className="text-xs text-paper leading-relaxed mt-1">
                    {fund.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {fund.holdings.map((h) => (
                      <span
                        key={h}
                        className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-rule text-zinc-300 font-mono"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t border-rule/60 pt-3 flex items-center justify-between text-[11px] text-ash">
                  <div>
                    <span className="text-zinc-500">Objective:</span>{" "}
                    <strong className="text-zinc-300 font-medium">{fund.objective}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-500">Min. Entry:</span>{" "}
                    <span className="font-mono text-zinc-300">{fund.minimumEntry}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How Funds Work on GUG */}
        <section className="bg-zinc-900/40 border border-rule rounded-2xl p-6 sm:p-8 flex flex-col gap-6">
          <h2 className="text-base sm:text-lg font-bold text-zinc-50 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-bullion" />
            Why Invest via Mutual Funds?
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
            <div className="flex flex-col gap-2">
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Briefcase className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-zinc-200 text-sm">Instant Risk Spread</h3>
              <p className="text-ash leading-relaxed">
                If an individual mine halts production or runs low on materials, your other holdings in the basket offset the variance.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Percent className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-zinc-200 text-sm">Automated Friday Payouts</h3>
              <p className="text-ash leading-relaxed">
                Fund dividends are automatically harvested from all held enterprises every Friday and deposited directly to your gold purse.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-zinc-200 text-sm">Guild Audited Ledgers</h3>
              <p className="text-ash leading-relaxed">
                Fund custodians regularly audit underlying company ledgers so passive investors never have to micromanage reports.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="border border-cyan-500/30 bg-cyan-950/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-1.5 text-center sm:text-left">
            <h3 className="font-bold text-base text-zinc-100">
              Want to list a Syndicate Fund for your Guild?
            </h3>
            <p className="text-xs text-ash max-w-md">
              High-ranking guild masters can propose custom multi-company funds to the High Registrar.
            </p>
          </div>
          <Link
            href="/ipo"
            className="h-10 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center transition shrink-0 shadow-lg shadow-cyan-600/20"
          >
            Apply for Fund Charter
          </Link>
        </div>
      </main>
    </div>
  );
}
