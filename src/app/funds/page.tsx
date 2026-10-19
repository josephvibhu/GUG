import Link from "next/link";
import Navbar from "@/components/Navbar";
import { 
  Landmark, 
  Sparkles, 
  ShieldAlert, 
  ArrowLeft, 
  PieChart, 
  ShieldCheck, 
  Percent, 
  Briefcase, 
  Clock, 
  Swords, 
  Dices, 
  Shield 
} from "lucide-react";

export const metadata = {
  title: "Mutual Funds & Indexes (Coming Soon) — Grow Ur Gold",
  description: "Season 2 preview: GUG-Gurantee, GUG-Luck, and GUG-WarBased diversified syndicate funds on Grow Ur Gold.",
};

const UPCOMING_FUNDS = [
  {
    ticker: "GUG-Gurantee",
    name: "GUG-Gurantee Fund",
    category: "Capital Protection",
    objective: "Guaranteed Weekly Returns & Zero Default Risk",
    holdings: ["Operator Vault Reserve (60%)", "Tier-1 Tool Foundries (40%)"],
    targetYield: "7.5% weekly guaranteed",
    minimumEntry: "25 gold",
    icon: "🛡️",
    color: "from-amber-500/25 to-yellow-500/20 text-amber-400 border-amber-500/35",
    description: "100% underwritten by the High Operator Treasury. Guaranteed weekly dividend payouts regardless of realm market fluctuations or military upheaval. Built for cautious citizens who demand rock-solid gold security.",
  },
  {
    ticker: "GUG-Luck",
    name: "GUG-Luck High-Roller Trust",
    category: "Speculative High-Beta",
    objective: "Maximum Jackpot Dividend Windfalls",
    holdings: ["Deep-Mine Prospectors (50%)", "Frontier Caravans (30%)", "Speculative Startups (20%)"],
    targetYield: "0% - 35% jackpot yield",
    minimumEntry: "50 gold",
    icon: "🎲",
    color: "from-purple-500/25 to-pink-500/20 text-purple-400 border-purple-500/35",
    description: "Invests in unpredictable, high-variance expeditions and speculative mineral discoveries. When fortune strikes, shareholders feast on massive Friday jackpot dividend distributions.",
  },
  {
    ticker: "GUG-WarBased",
    name: "GUG-WarBased Logistics Fund",
    category: "Military & Defense Industry",
    objective: "War-Cycle Hedging & Weaponry Production",
    holdings: ["Weaponsmith Forges (45%)", "Iron Armor Foundries (35%)", "Warship Shipyards (20%)"],
    targetYield: "15% - 25% conflict yield",
    minimumEntry: "100 gold",
    icon: "⚔️",
    color: "from-rose-500/25 to-red-500/20 text-rose-400 border-rose-500/35",
    description: "Allocated strictly across arms manufacturers, armor smelters, and war fleets. As sovereign nations wage battle, munitions consumption surges and fund dividends skyrocket.",
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
            Three tailored institutional funds for every investor archetype: Guaranteed income, Fortune high-rolling, and War-cycle profiteering.
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
              The Three Official GUG Funds
            </h2>
            <span className="text-xs text-ash">Q4 2026 Launch Window</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {UPCOMING_FUNDS.map((fund) => (
              <div
                key={fund.ticker}
                className="bg-pane/50 border border-rule hover:border-zinc-700 rounded-2xl p-5 flex flex-col justify-between gap-4 transition shadow-lg"
              >
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${fund.color} flex items-center justify-center font-mono font-extrabold text-xl`}>
                        {fund.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-sm text-zinc-100">{fund.ticker}</span>
                        </div>
                        <span className="text-[11px] text-ash">{fund.name}</span>
                      </div>
                    </div>

                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {fund.category}
                    </span>
                  </div>

                  <div className="text-left pt-1">
                    <span className="text-[10px] text-zinc-500 block uppercase font-mono">Target Return</span>
                    <span className="font-mono font-bold text-sm text-emerald-400">{fund.targetYield}</span>
                  </div>

                  <p className="text-xs text-paper leading-relaxed mt-1">
                    {fund.description}
                  </p>

                  <div className="flex flex-wrap gap-1 mt-1">
                    {fund.holdings.map((h) => (
                      <span
                        key={h}
                        className="text-[9px] px-2 py-0.5 rounded bg-zinc-900 border border-rule text-zinc-300 font-mono"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t border-rule/60 pt-3 flex items-center justify-between text-[11px] text-ash">
                  <div>
                    <span className="text-zinc-500">Min Entry:</span>{" "}
                    <strong className="text-zinc-200 font-mono">{fund.minimumEntry}</strong>
                  </div>
                  <span className="text-[10px] text-cyan-400 font-semibold">Audited Ledger</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How Funds Work on GUG */}
        <section className="bg-zinc-900/40 border border-rule rounded-2xl p-6 sm:p-8 flex flex-col gap-6">
          <h2 className="text-base sm:text-lg font-bold text-zinc-50 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-bullion" />
            Why Invest in GUG Mutual Funds?
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
            <div className="flex flex-col gap-2">
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-zinc-200 text-sm">GUG-Gurantee Reliability</h3>
              <p className="text-ash leading-relaxed">
                Guaranteed yield backed by the High Operator vault without the risk of single factory insolvencies.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Dices className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-zinc-200 text-sm">GUG-Luck Jackpot Payouts</h3>
              <p className="text-ash leading-relaxed">
                For citizens seeking asymmetric upside and fortune windfalls from high-risk expeditions.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-8 w-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Swords className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-zinc-200 text-sm">GUG-WarBased Military Hedge</h3>
              <p className="text-ash leading-relaxed">
                Turn sovereign conflict into weekly gold dividends as weapons and armor demand reaches peak levels.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="border border-cyan-500/30 bg-cyan-950/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-1.5 text-center sm:text-left">
            <h3 className="font-bold text-base text-zinc-100">
              Ready to invest when funds launch?
            </h3>
            <p className="text-xs text-ash max-w-md">
              Keep gold in your purse to be among the first unit holders on opening bell day.
            </p>
          </div>
          <Link
            href="/trade"
            className="h-10 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center transition shrink-0 shadow-lg shadow-cyan-600/20"
          >
            Explore Active Stocks Now
          </Link>
        </div>
      </main>
    </div>
  );
}
