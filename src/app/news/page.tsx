"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Newspaper, Building2, Coins, ArrowRight, ShieldAlert, Sparkles, Filter } from "lucide-react";
import { fmtUtcDate } from "@/lib/format";

interface NewsItem {
  id: string;
  type: "ANNOUNCEMENT" | "DIVIDEND_REPORT";
  title: string;
  content: string;
  ticker: string;
  companyName: string;
  logoUrl: string;
  author: string;
  createdAt: string;
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | "ANNOUNCEMENT" | "DIVIDEND_REPORT">("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/news")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.feed) {
          setItems(data.feed);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filtered = filter === "ALL" ? items : items.filter((x) => x.type === filter);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans">
      <Navbar />

      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6 flex-1">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-rule">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Newspaper className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Bourse Dispatches
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Live Feed
                </span>
              </h1>
              <p className="text-xs text-ash mt-0.5">
                Official regulatory filings, company earnings releases, and shareholder declarations.
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-zinc-900 border border-rule self-start sm:self-auto text-xs">
            {(
              [
                ["ALL", "All News"],
                ["ANNOUNCEMENT", "Announcements"],
                ["DIVIDEND_REPORT", "Dividends & Filings"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  filter === key
                    ? "bg-amber-500 text-black font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {/* Content list */}
        {loading ? (
          <div className="py-20 flex items-center justify-center text-ash text-sm font-mono">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mr-3" />
            Loading dispatches...
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-rule rounded-xl p-12 text-center flex flex-col items-center gap-3">
            <Newspaper className="w-8 h-8 text-zinc-600" />
            <p className="text-sm text-ash font-medium">No corporate dispatches published yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((item) => {
              const isDividend = item.type === "DIVIDEND_REPORT";
              return (
                <article
                  key={item.id}
                  className="p-5 rounded-xl border border-rule bg-floor/60 hover:border-zinc-700 transition flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-lg bg-pane border border-rule flex items-center justify-center text-base shrink-0">
                        {item.logoUrl}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/trade/${item.ticker}`}
                            className="font-bold text-sm text-zinc-100 hover:text-amber-400 transition"
                          >
                            ${item.ticker}
                          </Link>
                          <span className="text-xs text-ash">·</span>
                          <span className="text-xs text-ash">{item.companyName}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isDividend
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                                : "bg-purple-500/15 text-purple-400 border border-purple-500/20"
                            }`}
                          >
                            {isDividend ? "FINANCIAL" : "DISPATCH"}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-500">
                          Filed by {item.author} · {fmtUtcDate(item.createdAt)}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/trade/${item.ticker}`}
                      className="text-xs font-semibold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 shrink-0"
                    >
                      Trade <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  <div className="pt-1">
                    <h2 className="text-sm font-bold text-white mb-1.5">{item.title}</h2>
                    <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">{item.content}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
