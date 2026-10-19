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
  Vote, 
  Clock,
  Wheat
} from "lucide-react";

export const metadata = {
  title: "BREADCOIN (Coming Soon) — Grow Ur Gold",
  description: "Season 2 preview: BREADCOIN ($BREADCOIN), the premier decentralized carbohydrate currency of Parlamentum.",
};

const UPCOMING_TOKENS = [
  {
    ticker: "$BREADCOIN",
    name: "Breadcoin",
    type: "Decentralized Carbohydrate Reserve",
    description: "The premier edible digital asset of Parlamentum. Backed 1:1 by grain reserves, flour harvests, and bakery production across all sovereign realms. Stakable for fresh daily loaf yields, immune to fiat depreciation, and guaranteed 100% wholesome.",
    backing: "Certified Bakery Flour & Grain Vaults",
    targetSupply: "1,000,000 BREAD",
    badge: "Freshly Baked",
    color: "from-amber-500/30 via-yellow-500/20 to-orange-500/20 text-amber-400 border-amber-500/40",
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
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Season 2 Expansion
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
              <Clock className="w-3 h-3 text-amber-400" /> Coming Soon
            </span>
          </div>

          <h1 className="condensed text-3xl sm:text-5xl font-extrabold text-zinc-50 tracking-tight leading-none mt-1">
            Crypto: BREADCOIN ($BREADCOIN)
          </h1>
          <p className="text-sm sm:text-base text-ash max-w-2xl leading-relaxed">
            The single sovereign cryptocurrency of Grow Ur Gold. Fueling bakeries, grain mills, and realm sustenance with automated liquidity.
          </p>
        </div>

        {/* Notice Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3 text-xs text-amber-200/90">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="leading-snug">
            <strong className="text-amber-300">In-Game Rule:</strong> Played with Parlamentum gold only. No real money goes in or comes out. Not run by the Parlamentum team.
          </div>
        </div>

        {/* Featured Token Card */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              Featured Official Cryptocurrency
            </h2>
            <span className="text-xs text-ash">Q4 2026 Testnet</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {UPCOMING_TOKENS.map((token) => (
              <div
                key={token.ticker}
                className="bg-pane/50 border border-amber-500/30 hover:border-amber-500/50 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6 transition shadow-2xl relative overflow-hidden"
              >
                <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${token.color} flex items-center justify-center font-mono font-black text-2xl shadow-lg border`}>
                        🍞
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-extrabold text-2xl text-amber-300">{token.ticker}</span>
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/40">
                            {token.badge}
                          </span>
                        </div>
                        <span className="text-sm text-ash">{token.name}</span>
                      </div>
                    </div>

                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-300/90 bg-amber-950/40 border border-amber-800/40 px-3 py-1 rounded-lg w-fit">
                      {token.type}
                    </span>
                  </div>

                  <p className="text-sm text-paper leading-relaxed max-w-3xl">
                    {token.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-rule/60 pt-4 text-xs">
                  <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                    <span className="text-zinc-500 text-[10px] uppercase font-mono block">Vault Backing</span>
                    <strong className="text-zinc-200 font-semibold text-xs mt-0.5 block">{token.backing}</strong>
                  </div>
                  <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                    <span className="text-zinc-500 text-[10px] uppercase font-mono block">Target Supply Cap</span>
                    <span className="font-mono text-zinc-200 font-bold text-xs mt-0.5 block">{token.targetSupply}</span>
                  </div>
                  <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                    <span className="text-zinc-500 text-[10px] uppercase font-mono block">Primary Feature</span>
                    <span className="font-mono text-amber-300 font-bold text-xs mt-0.5 block">Daily Staking Loaf Yield</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Feature Highlights */}
        <section className="bg-zinc-900/40 border border-rule rounded-2xl p-6 sm:p-8 flex flex-col gap-6">
          <h2 className="text-base sm:text-lg font-bold text-zinc-50 flex items-center gap-2">
            <Layers className="w-5 h-5 text-bullion" />
            Core Mechanics of BREADCOIN
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
            <div className="flex flex-col gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <RefreshCw className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-zinc-200 text-sm">24/7 Automated Swaps (AMM)</h3>
              <p className="text-ash leading-relaxed">
                Swap gold directly for BREADCOIN any hour of the day or night through automated liquidity pools without waiting for floor bells.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Flame className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-zinc-200 text-sm">Bakery Staking Yields</h3>
              <p className="text-ash leading-relaxed">
                Stake BREADCOIN in participating realm bakeries to harvest weekly dividend rewards paid out in gold and grain coupons.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Wheat className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-zinc-200 text-sm">Tangible Flour Backing</h3>
              <p className="text-ash leading-relaxed">
                Every BREADCOIN corresponds to real grain produced and logged in the open financial ledgers of registered food enterprises.
              </p>
            </div>
          </div>
        </section>

        {/* Waitlist Banner */}
        <div className="border border-amber-500/30 bg-amber-950/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-1.5 text-center sm:text-left">
            <h3 className="font-bold text-base text-zinc-100">
              Want early access to the BREADCOIN Liquidity Pool?
            </h3>
            <p className="text-xs text-ash max-w-md">
              Join the community Discord to participate in the testnet launch and bakery liquidity provision.
            </p>
          </div>
          <Link
            href="/trade"
            className="h-10 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center transition shrink-0 shadow-lg shadow-amber-500/20"
          >
            Explore Active Stocks Now
          </Link>
        </div>
      </main>
    </div>
  );
}
