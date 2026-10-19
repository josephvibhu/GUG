"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Search, 
  TrendingUp, 
  Coins, 
  Landmark, 
  Sparkles, 
  Clock, 
  ArrowRight, 
  ShieldAlert, 
  PieChart, 
  RefreshCw 
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Sparkline from "@/components/Sparkline";
import { FloorStrip } from "@/components/FloorClock";
import { useMarketFeed } from "@/hooks/useMarketFeed";
import { fmtPrice, fmtPct, fmtCompact, moveColor } from "@/lib/format";

export default function HomePage() {
  const router = useRouter();
  const { loaded, companies, schedule, clockOffset, sparklines } = useMarketFeed();
  const [tab, setTab] = useState<"EQUITIES" | "CRYPTO" | "FUNDS">("EQUITIES");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => [c.ticker, c.name, c.sector].some((v) => v.toLowerCase().includes(q)));
  }, [companies, query]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col gap-8">
        <FloorStrip schedule={schedule} clockOffset={clockOffset} />

        {/* Global In-Game Currency Notice Banner */}
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-amber-200/90 shadow-sm">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Played with <strong className="text-amber-200 font-semibold">Parlamentum gold only</strong>. No real money goes in or comes out. Not run by the Parlamentum team.
            </span>
          </div>
          <Link
            href="/terms"
            className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 shrink-0 transition hidden sm:inline"
          >
            Terms & Rules &rarr;
          </Link>
        </div>

        {/* Section Segment Switcher: Equities vs Crypto vs Mutual Funds */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-4">
          <div className="flex items-center gap-1.5 p-1 bg-pane border border-rule rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setTab("EQUITIES")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                tab === "EQUITIES"
                  ? "bg-zinc-800 text-zinc-50 shadow-sm border border-zinc-700/60"
                  : "text-ash hover:text-paper"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-bullion" />
              <span>Equities</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 border border-rule text-zinc-300">
                {loaded ? companies.length : "…"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTab("CRYPTO")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                tab === "CRYPTO"
                  ? "bg-purple-950/80 text-purple-200 border border-purple-500/40 shadow-sm"
                  : "text-ash hover:text-paper"
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-purple-400" />
              <span>Crypto & Tokens</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                SOON
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTab("FUNDS")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                tab === "FUNDS"
                  ? "bg-cyan-950/80 text-cyan-200 border border-cyan-500/40 shadow-sm"
                  : "text-ash hover:text-paper"
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-cyan-400" />
              <span>Mutual Funds</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                SOON
              </span>
            </button>
          </div>

          {tab === "EQUITIES" && companies.length > 3 && (
            <label className="relative">
              <span className="sr-only">Search companies</span>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ash" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ticker, name, or sector"
                className="h-8 w-60 rounded-[4px] border border-rule bg-floor pl-8 pr-2 text-[13px] text-paper placeholder:text-ash focus:outline-none focus:border-zinc-500"
              />
            </label>
          )}
        </div>

        {/* TAB 1: EQUITIES */}
        {tab === "EQUITIES" && (
          <section aria-labelledby="listings" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 id="listings" className="text-[15px] font-semibold text-zinc-50">
                Active Listed Companies <span className="text-ash font-normal">{loaded ? `(${companies.length})` : ""}</span>
              </h2>
            </div>

            {loaded && companies.length === 0 ? (
              <div className="border border-rule rounded-[4px] px-6 py-12 flex flex-col items-start gap-3">
                <p className="text-[15px] text-zinc-50 font-semibold">No companies are listed yet.</p>
                <p className="text-sm text-ash max-w-md">
                  Apply to list yours: pick a ticker, a share count and a price. The operator reviews it before the first shares go on sale.
                </p>
                <Link href="/ipo" className="mt-1 h-9 px-4 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor text-[13px] font-semibold flex items-center">
                  List a company
                </Link>
              </div>
            ) : (
              <div className="border border-rule rounded-[4px] overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-[12px] text-ash border-b border-rule">
                      <th scope="col" className="text-left font-normal py-2.5 pl-4 pr-2">Company</th>
                      <th scope="col" className="text-right font-normal py-2.5 px-2">Last</th>
                      <th scope="col" className="text-right font-normal py-2.5 px-2">24h</th>
                      <th scope="col" className="text-right font-normal py-2.5 px-2 hidden md:table-cell">24h volume</th>
                      <th scope="col" className="text-right font-normal py-2.5 px-2 hidden sm:table-cell">Market cap</th>
                      <th scope="col" className="text-right font-normal py-2.5 pl-2 pr-4 hidden lg:table-cell">14 days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loaded &&
                      [0, 1, 2].map((i) => (
                        <tr key={i} className="border-b border-rule last:border-0">
                          <td colSpan={6} className="h-[57px]">
                            <div className="mx-4 h-3 w-40 rounded bg-pane" />
                          </td>
                        </tr>
                      ))}
                    {rows.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => router.push(`/trade/${c.ticker}`)}
                        className="border-b border-rule last:border-0 hover:bg-pane cursor-pointer"
                      >
                        <td className="py-2.5 pl-4 pr-2">
                          <Link href={`/trade/${c.ticker}`} className="flex items-center gap-3 min-w-0" onClick={(e) => e.stopPropagation()}>
                            <span className="h-8 w-8 shrink-0 rounded-[4px] bg-pane border border-rule flex items-center justify-center text-base" aria-hidden>
                              {c.logoUrl}
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-2">
                                <span className="condensed font-bold text-[15px] text-zinc-50 tracking-tight">{c.ticker}</span>
                                {c.status !== "ACTIVE" && (
                                  <span className="text-[11px] px-1.5 rounded-[3px] border border-bear/50 text-bear">
                                    {c.status === "HALTED" ? "Halted" : "Defaulted"}
                                  </span>
                                )}
                              </span>
                              <span className="block text-[12px] text-ash truncate max-w-[220px] sm:max-w-[320px]">{c.name}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="py-2.5 px-2 text-right text-zinc-50 font-medium">{fmtPrice(c.currentPrice)}</td>
                        <td className={`py-2.5 px-2 text-right ${moveColor(c.change24h)}`}>{fmtPct(c.change24h)}</td>
                        <td className="py-2.5 px-2 text-right text-paper hidden md:table-cell">{fmtCompact(c.volume24h)}</td>
                        <td className="py-2.5 px-2 text-right text-paper hidden sm:table-cell">{fmtCompact(c.marketCap)}</td>
                        <td className="py-2.5 pl-2 pr-4 hidden lg:table-cell">
                          <span className="flex justify-end">
                            <Sparkline points={sparklines[c.id]} />
                          </span>
                        </td>
                      </tr>
                    ))}
                    {loaded && companies.length > 0 && rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 px-4 text-ash">No company matches “{query}”.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[12px] text-ash">Prices and volumes in gold. 24h compares with the last trade before the previous 24 hours.</p>
          </section>
        )}

        {/* TAB 2: CRYPTO & TOKENS (COMING SOON) */}
        {tab === "CRYPTO" && (
          <section className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-950/20 border border-purple-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-zinc-100 text-base">Crypto & Commodity Tokens</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      COMING SOON
                    </span>
                  </div>
                  <p className="text-xs text-ash mt-0.5">
                    Automated market makers (AMM), wrapped iron ore, and decentralized commodity reserves for Parlamentum.
                  </p>
                </div>
              </div>
              <Link
                href="/crypto"
                className="h-8 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 transition shrink-0"
              >
                Full Details <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  ticker: "$wIRON",
                  name: "Wrapped Raw Iron",
                  tag: "Commodity",
                  desc: "1:1 physical iron ore backed in vault reserves. Enables zero-tax instant resource swaps.",
                  yield: "Zero slippage",
                },
                {
                  ticker: "$GRAINX",
                  name: "Grain & Crop Index",
                  tag: "Synthetic",
                  desc: "Tracks multi-realm farm harvest outputs and food prices algorithmically.",
                  yield: "Variable yield",
                },
                {
                  ticker: "$GUILD",
                  name: "Merchant Governance",
                  tag: "Governance",
                  desc: "Vote on exchange listing standards and collect 35% of platform transaction fees.",
                  yield: "Weekly dividend",
                },
                {
                  ticker: "$GOLDX",
                  name: "Liquid Gold Vault",
                  tag: "Reserve",
                  desc: "Fractionalized sovereign gold treasury notes for automated micro-investments.",
                  yield: "100% Backed",
                },
              ].map((token) => (
                <div
                  key={token.ticker}
                  className="bg-pane border border-rule hover:border-zinc-700 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-base text-purple-300">{token.ticker}</span>
                      <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-zinc-900 border border-rule text-zinc-400">
                        {token.tag}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-zinc-200">{token.name}</div>
                    <p className="text-[11px] text-ash leading-relaxed">{token.desc}</p>
                  </div>
                  <div className="border-t border-rule/60 pt-2.5 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500">Feature:</span>
                    <span className="font-mono text-zinc-300">{token.yield}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 3: MUTUAL FUNDS (COMING SOON) */}
        {tab === "FUNDS" && (
          <section className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-cyan-950/20 border border-cyan-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-zinc-100 text-base">Mutual Funds & Syndicate Trusts</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      COMING SOON
                    </span>
                  </div>
                  <p className="text-xs text-ash mt-0.5">
                    Invest in baskets of companies with automated Friday dividend distributions and guild-backed ledgers.
                  </p>
                </div>
              </div>
              <Link
                href="/funds"
                className="h-8 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 transition shrink-0"
              >
                Full Details <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  ticker: "HISF",
                  name: "Heavy Industry Index",
                  tag: "Industrial",
                  desc: "Basket of top iron mines, toolworks, and smelting foundries across all realms.",
                  yield: "8.5% weekly target",
                },
                {
                  ticker: "FAT",
                  name: "Food & Agriculture Trust",
                  tag: "Commodity",
                  desc: "Invests in grain farms, bakeries, and food distribution networks.",
                  yield: "11.2% weekly target",
                },
                {
                  ticker: "PHYD",
                  name: "High-Yield Dividend Fund",
                  tag: "Income",
                  desc: "Aggregates the top 5 dividend-paying companies for automated Friday payouts.",
                  yield: "14.8% weekly target",
                },
                {
                  ticker: "FMCS",
                  name: "Founders Syndicate Trust",
                  tag: "Blue-Chip",
                  desc: "Conservative multi-sector holding syndicate managed by certified patriarchs.",
                  yield: "9.0% weekly target",
                },
              ].map((fund) => (
                <div
                  key={fund.ticker}
                  className="bg-pane border border-rule hover:border-zinc-700 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-base text-cyan-300">{fund.ticker}</span>
                      <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-zinc-900 border border-rule text-zinc-400">
                        {fund.tag}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-zinc-200">{fund.name}</div>
                    <p className="text-[11px] text-ash leading-relaxed">{fund.desc}</p>
                  </div>
                  <div className="border-t border-rule/60 pt-2.5 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500">Yield Goal:</span>
                    <span className="font-mono text-emerald-400 font-semibold">{fund.yield}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
