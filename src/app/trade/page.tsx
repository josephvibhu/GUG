"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { TrendingUp, PlusCircle, Building2, Clock, Sparkles } from "lucide-react";

export default function TradeIndexPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<any[]>([]);
  const [marketSchedule, setMarketSchedule] = useState<any>(null);

  useEffect(() => {
    fetch("/api/market", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.companies && data.companies.length > 0) {
          router.replace(`/trade/${data.companies[0].ticker}`);
        } else {
          setCompanies([]);
          if (data.marketSchedule) setMarketSchedule(data.marketSchedule);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-3 text-amber-400 font-mono text-sm">
            <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            Connecting to Exchange Trading Terminal...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <Navbar />

      <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6 flex-1 justify-center">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center gap-4 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl shadow-xl shadow-amber-500/5">
            🏛️
          </div>

          <div className="max-w-md">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Exchange Trading Floor
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              No Equities Listed for Trading Yet
            </h1>

            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mt-2">
              All pre-stocks have been cleared. To open the trading terminal, a company must first be approved and chartered onto the bourse floor.
            </p>

            {marketSchedule && (
              <div className="mt-4 p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono inline-flex items-center gap-3 text-zinc-300">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>
                  Official Session: <strong>{marketSchedule.openTimeStr} – {marketSchedule.closeTimeStr} UTC</strong>
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  marketSchedule.isOpen ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                }`}>
                  {marketSchedule.isOpen ? "FLOOR OPEN" : "FLOOR CLOSED"}
                </span>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/ipo"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Launch First Company IPO
              </Link>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-semibold text-xs transition cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-purple-400" />
                Operator Charter Queue
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
