import Link from "next/link";
import Navbar from "@/components/Navbar";
import { 
  Coins, 
  Sparkles, 
  ShieldAlert, 
  ArrowLeft, 
  Layers, 
  Flame, 
  RefreshCw, 
  Lock, 
  TrendingUp, 
  Vote, 
  CheckCircle2, 
  Clock 
} from "lucide-react";

export const metadata = {
  title: "Crypto & Tokens (Coming Soon) — Grow Ur Gold",
  description: "Season 2 preview: Tokenized commodities, AMM liquidity pools, and decentralized resource tokens on Grow Ur Gold.",
};

const UPCOMING_TOKENS = [
  {
    ticker: "$wIRON",
    name: "Wrapped Raw Iron",
    type: "Commodity Backed",
    description: "1:1 vault-backed token representing physical Raw Iron stored with the High Operator. Enables instant zero-tax resource settlements without opening in-game market trades.",
    backing: "1 wIRON = 1 In-Game Raw Iron (5g)",
    targetSupply: "500,000 wIRON",
    badge: "Vault Audited",
    color: "from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30",
  },
  {
    ticker: "$GRAINX",
    name: "Grain & Crop Index Token",
    type: "Synthetic Commodity",
    description: "Tracks aggregate wheat harvests, bakery output, and flour prices across all sovereign realms. Automatically reflects seasonal scarcity and food supplies.",
    backing: "Market basket of in-game food commodities",
    targetSupply: "1,000,000 GRAINX",
    badge: "Yield Bearing",
    color: "from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30",
  },
  {
    ticker: "$GUILD",
    name: "Merchant Guild Governance",
    type: "Governance & Fee Share",
    description: "Holders vote on listing approvals, exchange fee structures, and receive 35% of all exchange transaction fees redistributed bi-weekly in gold.",
    backing: "Exchange treasury revenue stream",
    targetSupply: "250,000 GUILD",
    badge: "Fee Share",
    color: "from-purple-500/20 to-indigo-500/20 text-purple-400 border-purple-500/30",
  },
  {
    ticker: "$GOLDX",
    name: "Liquid Gold Vault Certificate",
    type: "Synthetic Reserve",
    description: "Fractionalized treasury notes backed by sovereign gold vaults. Trade smaller increments of gold for micro-transactions and automated recurring investment.",
    backing: "100% gold purse reserves",
    targetSupply: "Dynamic",
    badge: "High Liquidity",
    color: "from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30",
  },
];

export default function CryptoPage() {
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
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Season 2 Expansion
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
              <Clock className="w-3 h-3 text-amber-400" /> Coming Soon
            </span>
          </div>

          <h1 className="condensed text-3xl sm:text-5xl font-extrabold text-zinc-50 tracking-tight leading-none mt-1">
            Crypto & Commodity Tokens
          </h1>
          <p className="text-sm sm:text-base text-ash max-w-2xl leading-relaxed">
            Bringing automated liquidity, wrapped commodity reserves, and 24/7 algorithmic swaps to the Parlamentum financial ecosystem.
          </p>
        </div>

        {/* Notice Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3 text-xs text-amber-200/90">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="leading-snug">
            <strong className="text-amber-300">In-Game Rule:</strong> Played with Parlamentum gold only. No real money goes in or comes out. Not run by the Parlamentum team.
          </div>
        </div>

        {/* Preview Token Grid */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Coins className="w-4 h-4 text-purple-400" />
              Upcoming Tokens in Pipeline
            </h2>
            <span className="text-xs text-ash">Q4 2026 Testnet</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {UPCOMING_TOKENS.map((token) => (
              <div
                key={token.ticker}
                className="bg-pane/50 border border-rule hover:border-zinc-700 rounded-2xl p-5 flex flex-col justify-between gap-4 transition shadow-lg"
              >
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${token.color} flex items-center justify-center font-mono font-extrabold text-base`}>
                        {token.ticker.slice(1, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-base text-zinc-100">{token.ticker}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {token.badge}
                          </span>
                        </div>
                        <span className="text-xs text-ash">{token.name}</span>
                      </div>
                    </div>

                    <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400/90 bg-purple-950/40 border border-purple-800/40 px-2 py-0.5 rounded">
                      {token.type}
                    </span>
                  </div>

                  <p className="text-xs text-paper leading-relaxed mt-1">
                    {token.description}
                  </p>
                </div>

                <div className="border-t border-rule/60 pt-3 flex items-center justify-between text-[11px] text-ash">
                  <div>
                    <span className="text-zinc-500">Backing:</span>{" "}
                    <strong className="text-zinc-300 font-medium">{token.backing}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-500">Supply:</span>{" "}
                    <span className="font-mono text-zinc-300">{token.targetSupply}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Feature Highlights: How Tokens Work in Parlamentum */}
        <section className="bg-zinc-900/40 border border-rule rounded-2xl p-6 sm:p-8 flex flex-col gap-6">
          <h2 className="text-base sm:text-lg font-bold text-zinc-50 flex items-center gap-2">
            <Layers className="w-5 h-5 text-bullion" />
            Core Mechanics of the Token Economy
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
            <div className="flex flex-col gap-2">
              <div className="h-8 w-8 rounded-lg bg-bullion/10 border border-bullion/30 flex items-center justify-center text-bullion">
                <RefreshCw className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-zinc-200 text-sm">24/7 Automated Swaps (AMM)</h3>
              <p className="text-ash leading-relaxed">
                Unlike equities which trade during floor hours, token liquidity pools allow instantaneous gold-to-resource swaps day and night.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Flame className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-zinc-200 text-sm">Liquidity Provider Yields</h3>
              <p className="text-ash leading-relaxed">
                Deposit gold and $wIRON into exchange liquidity pools to earn a share of every trader&apos;s swap fee paid out in continuous yield.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Vote className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-zinc-200 text-sm">Decentralized Governance</h3>
              <p className="text-ash leading-relaxed">
                Vote on listing standards, margin lending parameters, and weekly operator fee disbursements with $GUILD tokens.
              </p>
            </div>
          </div>
        </section>

        {/* Waitlist Banner */}
        <div className="border border-purple-500/30 bg-purple-950/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-1.5 text-center sm:text-left">
            <h3 className="font-bold text-base text-zinc-100">
              Want early access to the $wIRON Liquidity Pool?
            </h3>
            <p className="text-xs text-ash max-w-md">
              Sign up for exchange alerts on the community Discord to test liquidity pools before mainnet launch.
            </p>
          </div>
          <Link
            href="/trade"
            className="h-10 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center transition shrink-0 shadow-lg shadow-purple-600/20"
          >
            Explore Active Stocks Now
          </Link>
        </div>
      </main>
    </div>
  );
}
