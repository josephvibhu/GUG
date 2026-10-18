"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Building2, 
  BarChart3, 
  Coins, 
  ArrowRight, 
  Sparkles,
  PlusCircle,
  ShieldCheck 
} from "lucide-react";
import { Company } from "@/lib/market";

export default function HomePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const fetchMarkets = async () => {
    try {
      const res = await fetch("/api/market", { cache: "no-store" });
      const data = await res.json();
      if (data.companies) {
        setCompanies(data.companies);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 8000);
    return () => clearInterval(interval);
  }, []);

  const sectors = ["ALL", ...Array.from(new Set(companies.map((c) => c.sector)))];

  const filteredCompanies = companies.filter((c) => {
    const matchesSearch =
      c.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.sector.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSector = selectedSector === "ALL" || c.sector === selectedSector;
    return matchesSearch && matchesSector;
  });

  const totalMarketCap = companies.reduce((sum, c) => sum + c.marketCap, 0);
  const total24hVolume = companies.reduce((sum, c) => sum + c.volume24h, 0);
  const topGainer = companies.length > 0 ? [...companies].sort((a, b) => b.change24h - a.change24h)[0] : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <Navbar onUserRefresh={fetchMarkets} />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8 flex-1">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 p-6 sm:p-10 shadow-2xl">
          <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" /> High Chancellor's Order of Commerce
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              Grow Ur Gold –{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-600">
                Parlamentum
              </span>
            </h1>
            <p className="mt-3 text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl">
              The official sovereign stock exchange for Parlamentum gold. Fund your purse via Raw Iron @ 5g, 
              issue shares for your guild enterprise via Curated IPOs, execute share buybacks, and trade with continuous order book matching.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/ipo"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition shadow-lg shadow-amber-500/20"
              >
                <PlusCircle className="w-4 h-4" />
                Launch a Public IPO
              </Link>
              {companies.length > 0 && (
                <Link
                  href={`/trade/${companies[0].ticker}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-semibold text-sm transition"
                >
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Open Terminal (${companies[0].ticker})
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Market Highlights Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Total Market Capitalization</span>
              <Coins className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white">
              {totalMarketCap.toLocaleString("en-US", { maximumFractionDigits: 0 })} <span className="text-xs font-sans text-zinc-400">gold</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">Across all public charters</div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>24h Exchange Volume</span>
              <BarChart3 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white">
              {total24hVolume.toLocaleString("en-US", { maximumFractionDigits: 0 })} <span className="text-xs font-sans text-zinc-400">gold</span>
            </div>
            <div className="text-[11px] text-emerald-400 mt-1">Active market liquidity</div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Chartered Companies</span>
              <Building2 className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white">
              {companies.length}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">Publicly trading on floor</div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Top Market Gainer</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
              {topGainer ? `+${topGainer.change24h.toFixed(2)}%` : "0.00%"}
            </div>
            <div className="text-[11px] text-zinc-300 mt-1">
              {topGainer ? `$${topGainer.ticker} (${topGainer.name})` : "Awaiting initial listings"}
            </div>
          </div>
        </div>

        {/* Directory Controls: Search and Sector Pills */}
        {companies.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search ticker, company, or sector..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition"
              />
            </div>

            {/* Sector Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none pb-1 sm:pb-0">
              {sectors.map((sec) => (
                <button
                  key={sec}
                  onClick={() => setSelectedSector(sec)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    selectedSector === sec
                      ? "bg-amber-500 text-black font-bold"
                      : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Listed Equities Table or Clean Empty State */}
        {companies.length === 0 ? (
          <div className="bg-zinc-900/40 border border-zinc-800 border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl">
              🏛️
            </div>
            <div className="max-w-md">
              <h3 className="text-xl font-bold text-white mb-1">
                No Public Equities Chartered Yet
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                All pre-stocks have been cleared. The exchange floor is open for citizen and parliamentary enterprises! 
                Incorporate your company, set your share supply and IPO price, and list your shares for public trading.
              </p>
              <Link
                href="/ipo"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-sm shadow-xl shadow-amber-500/20 transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Launch the First Company IPO
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs">
                <thead>
                  <tr className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                    <th className="py-3 px-4">Chartered Asset</th>
                    <th className="py-3 px-4">Sector</th>
                    <th className="py-3 px-4 text-right">Price (Gold)</th>
                    <th className="py-3 px-4 text-right">24h Change</th>
                    <th className="py-3 px-4 text-right hidden md:table-cell">24h High / Low</th>
                    <th className="py-3 px-4 text-right hidden sm:table-cell">24h Volume</th>
                    <th className="py-3 px-4 text-right">Market Cap</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {filteredCompanies.map((c) => {
                    const isUp = c.change24h >= 0;
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-zinc-800/40 transition group cursor-pointer"
                      >
                        {/* Asset */}
                        <td className="py-4 px-4 font-sans">
                          <Link href={`/trade/${c.ticker}`} className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-xl group-hover:border-amber-400/50 transition">
                              {c.logoUrl || "🏢"}
                            </div>
                            <div>
                              <div className="font-bold text-white text-sm flex items-center gap-2">
                                <span>{c.name}</span>
                                <span className="font-mono text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded">
                                  ${c.ticker}
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-400 font-sans line-clamp-1 max-w-xs">
                                {c.description}
                              </div>
                            </div>
                          </Link>
                        </td>

                        {/* Sector */}
                        <td className="py-4 px-4 font-sans text-zinc-400 text-xs">
                          {c.sector}
                        </td>

                        {/* Price */}
                        <td className="py-4 px-4 text-right font-bold text-white text-sm">
                          {c.currentPrice.toFixed(2)} gold
                        </td>

                        {/* 24h Change */}
                        <td className="py-4 px-4 text-right">
                          <span
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold ${
                              isUp ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                            }`}
                          >
                            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {isUp ? "+" : ""}
                            {c.change24h.toFixed(2)}%
                          </span>
                        </td>

                        {/* 24h High/Low */}
                        <td className="py-4 px-4 text-right text-zinc-300 text-xs hidden md:table-cell">
                          {c.high24h.toFixed(2)} / {c.low24h.toFixed(2)}
                        </td>

                        {/* 24h Volume */}
                        <td className="py-4 px-4 text-right text-zinc-300 text-xs hidden sm:table-cell">
                          {c.volume24h.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </td>

                        {/* Market Cap */}
                        <td className="py-4 px-4 text-right font-bold text-amber-400 text-xs">
                          {c.marketCap.toLocaleString("en-US", { maximumFractionDigits: 0 })} gold
                        </td>

                        {/* Action */}
                        <td className="py-4 px-4 text-center font-sans">
                          <Link
                            href={`/trade/${c.ticker}`}
                            className="inline-block px-3 py-1.5 rounded-lg bg-zinc-800 group-hover:bg-amber-500 group-hover:text-black text-zinc-200 font-semibold text-xs transition"
                          >
                            Trade
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
