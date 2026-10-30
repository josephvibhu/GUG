"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import Sparkline from "@/components/Sparkline";
import { FloorStrip } from "@/components/FloorClock";
import { useMarketFeed } from "@/hooks/useMarketFeed";
import { fmtPrice, fmtPct, fmtCompact, moveColor } from "@/lib/format";

export default function HomePage() {
  const router = useRouter();
  const { loaded, companies, schedule, clockOffset, sparklines } = useMarketFeed();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => [c.ticker, c.name, c.sector].some((v) => v.toLowerCase().includes(q)));
  }, [companies, query]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-8 sm:gap-10">
        <FloorStrip schedule={schedule} clockOffset={clockOffset} />

        <section aria-labelledby="listings" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="listings" className="text-[15px] font-semibold text-zinc-50">
              Listed companies <span className="text-ash font-normal tabular">{loaded ? companies.length : ""}</span>
            </h2>
            {companies.length > 3 && (
              <label className="relative w-full sm:w-auto">
                <span className="sr-only">Search companies</span>
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ash" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search ticker, name or sector"
                  className="h-9 sm:h-8 w-full sm:w-64 rounded-[4px] border border-rule bg-floor pl-8 pr-2 text-[13px] text-paper placeholder:text-ash focus:outline-none focus:border-zinc-500"
                />
              </label>
            )}
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
              <table className="w-full text-[13px] tabular">
                <thead>
                  <tr className="text-[12px] text-ash border-b border-rule">
                    <th scope="col" className="text-left font-normal py-2.5 pl-3 sm:pl-4 pr-2">Company</th>
                    <th scope="col" className="text-right font-normal py-2.5 px-2">Last</th>
                    <th scope="col" className="text-right font-normal py-2.5 pl-2 pr-3 sm:px-2">24h</th>
                    <th scope="col" className="text-right font-normal py-2.5 px-2 hidden md:table-cell">24h volume</th>
                    <th scope="col" className="text-right font-normal py-2.5 px-2 hidden sm:table-cell">Market cap</th>
                    <th scope="col" className="text-right font-normal py-2.5 px-2 hidden md:table-cell">Revenue / wk</th>
                    <th scope="col" className="text-right font-normal py-2.5 pl-2 pr-4 hidden lg:table-cell">14 days</th>
                  </tr>
                </thead>
                <tbody>
                  {!loaded &&
                    [0, 1, 2].map((i) => (
                      <tr key={i} className="border-b border-rule last:border-0">
                        <td colSpan={7} className="h-[57px]">
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
                      <td className="py-2.5 pl-3 sm:pl-4 pr-2">
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
                            <span className="block text-[12px] text-ash truncate max-w-[160px] sm:max-w-[320px]">{c.name}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-right text-zinc-50 font-medium">{fmtPrice(c.currentPrice)}</td>
                      <td className={`py-2.5 pl-2 pr-3 sm:px-2 text-right ${moveColor(c.change24h)}`}>{fmtPct(c.change24h)}</td>
                      <td className="py-2.5 px-2 text-right text-paper hidden md:table-cell">{fmtCompact(c.volume24h)}</td>
                      <td className="py-2.5 px-2 text-right text-paper hidden sm:table-cell">{fmtCompact(c.marketCap)}</td>
                      <td className="py-2.5 px-2 text-right text-paper hidden md:table-cell">{c.weeklyRevenue ? fmtCompact(c.weeklyRevenue) : "–"}</td>
                      <td className="py-2.5 pl-2 pr-4 hidden lg:table-cell">
                        <span className="flex justify-end">
                          <Sparkline points={sparklines[c.id]} />
                        </span>
                      </td>
                    </tr>
                  ))}
                  {loaded && companies.length > 0 && rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 px-4 text-ash">No company matches “{query}”.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[12px] text-ash">
            Prices and volumes in gold. 24h compares with the last trade before the previous 24 hours. Revenue is the founder&apos;s estimate.
          </p>
        </section>

        <section aria-labelledby="next" className="border-t border-rule pt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[13px]">
          <h2 id="next" className="text-ash">Coming soon</h2>`n          <Link href="/auction" className="text-paper hover:text-zinc-50 underline underline-offset-4 decoration-rule">Auction House</Link>
          <Link href="/crypto" className="text-paper hover:text-zinc-50 underline underline-offset-4 decoration-rule">BREADCOIN</Link>
          <Link href="/funds" className="text-paper hover:text-zinc-50 underline underline-offset-4 decoration-rule">GUG funds</Link>
        </section>
      </main>
    </div>
  );
}
