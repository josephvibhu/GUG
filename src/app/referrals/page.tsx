"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Users, Copy, Check, Sparkles, TrendingUp, Coins, ExternalLink, Share2, ShieldCheck, ArrowRight } from "lucide-react";
import { fmtGold, fmtUtcDate } from "@/lib/format";

interface ReferralData {
  codeInfo: {
    code: string;
    commissionPct: number;
    totalReferred: number;
    totalVolume: number;
    totalEarned: number;
    createdAt: string;
  };
  referredCitizens: Array<{
    id: string;
    username: string;
    displayName: string;
    joinedAt: string;
  }>;
  rewards: Array<{
    id: string;
    referredUsername: string;
    sourceType: string;
    tradeVolume: number;
    commissionGold: number;
    createdAt: string;
  }>;
}

export default function ReferralsPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<"citizens" | "rewards">("citizens");

  useEffect(() => {
    fetch("/api/referrals")
      .then(async (res) => {
        if (res.status === 401) {
          setError("Please log in to view your promoter & referral dashboard.");
          return;
        }
        const json = await res.json();
        if (!json.success) {
          setError(json.message || "Failed to load referral stats.");
          return;
        }
        setData(json);
      })
      .catch(() => setError("Network error loading referral program."))
      .finally(() => setLoading(false));
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://growurgold.vercel.app";
  const referralCode = data?.codeInfo.code || "...";
  const referralLink = `${origin}/?ref=${referralCode}`;

  const copyText = (text: string, isLink: boolean) => {
    navigator.clipboard.writeText(text);
    if (isLink) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-8">
        {/* Header */}
        <header className="flex flex-col gap-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-bullion" />
            <span className="text-[12px] uppercase font-bold tracking-wider text-bullion">Affiliate & Promoter Program</span>
          </div>
          <h1 className="condensed text-3xl sm:text-4xl font-extrabold text-zinc-50 tracking-tight leading-tight">
            Grow UR Gold Affiliate Hub
          </h1>
          <p className="text-[14px] text-paper leading-relaxed">
            Invite fellow citizens, merchants, and guilds into Parlamentum&apos;s 24/7 financial exchange. You earn gold commission on every matched trade executed by your referrals!
          </p>
        </header>

        {error ? (
          <div className="p-6 rounded-[4px] border border-rule bg-pane flex flex-col items-start gap-3">
            <p className="text-[14px] text-paper">{error}</p>
            <Link
              href="/login"
              className="h-8 px-4 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-semibold text-[13px] flex items-center gap-1.5"
            >
              Log in / Register <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : loading ? (
          <div className="p-12 text-center text-ash text-sm">Loading promoter stats…</div>
        ) : data ? (
          <>
            {/* Primary Share Box */}
            <div className="p-5 sm:p-6 rounded-[6px] border border-rule bg-pane flex flex-col gap-5 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-ash uppercase tracking-wider">Your Personal Promoter Code</span>
                  <div className="flex items-center gap-3">
                    <span className="condensed text-3xl font-extrabold text-bullion tracking-wider bg-floor px-3 py-1 rounded-[4px] border border-bullion/40 select-all">
                      {referralCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(referralCode, false)}
                      className="h-8 px-2.5 rounded-[4px] border border-rule hover:border-zinc-500 text-[12px] text-paper flex items-center gap-1"
                    >
                      {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedCode ? "Copied" : "Copy Code"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-1">
                  <span className="text-[11px] font-semibold text-ash uppercase tracking-wider">Commission Tier</span>
                  <span className="text-[13px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-[4px]">
                    {data.codeInfo.commissionPct}% of Exchange Trading Fees
                  </span>
                </div>
              </div>

              {/* Shareable Link Input */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-rule/80">
                <span className="text-[12px] text-ash">Shareable Invite Link</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={referralLink}
                    className="h-10 flex-1 px-3 rounded-[4px] bg-floor border border-rule text-[13px] text-zinc-100 font-mono select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyText(referralLink, true)}
                    className="h-10 px-4 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-bold text-[13px] flex items-center gap-1.5 shrink-0 transition-colors"
                  >
                    {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedLink ? "Link Copied!" : "Copy Link"}
                  </button>
                </div>
              </div>
            </div>

            {/* Metric Cards */}
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-rule border border-rule rounded-[4px] overflow-hidden">
              <div className="bg-floor p-4 flex flex-col gap-1">
                <dt className="text-[12px] text-ash flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-bullion" /> Citizens Referred
                </dt>
                <dd className="condensed text-2xl font-bold text-zinc-50 tabular">
                  {data.codeInfo.totalReferred}
                </dd>
              </div>

              <div className="bg-floor p-4 flex flex-col gap-1">
                <dt className="text-[12px] text-ash flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-sky-400" /> Trading Volume
                </dt>
                <dd className="condensed text-2xl font-bold text-zinc-50 tabular">
                  {fmtGold(data.codeInfo.totalVolume)} gold
                </dd>
              </div>

              <div className="bg-floor p-4 flex flex-col gap-1">
                <dt className="text-[12px] text-ash flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-emerald-400" /> Lifetime Earned
                </dt>
                <dd className="condensed text-2xl font-bold text-emerald-400 tabular">
                  {fmtGold(data.codeInfo.totalEarned)} gold
                </dd>
              </div>

              <div className="bg-floor p-4 flex flex-col gap-1">
                <dt className="text-[12px] text-ash flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-bullion" /> Promoter Status
                </dt>
                <dd className="text-[14px] font-bold text-bullion flex items-center gap-1.5 mt-1">
                  Active Partner 🟢
                </dd>
              </div>
            </dl>

            {/* Tables Section */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-rule pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("citizens")}
                  className={`h-8 px-3 rounded-[4px] text-[13px] font-semibold transition-colors ${
                    activeTab === "citizens" ? "bg-rule text-zinc-50" : "text-ash hover:text-paper"
                  }`}
                >
                  Referred Citizens ({data.referredCitizens.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("rewards")}
                  className={`h-8 px-3 rounded-[4px] text-[13px] font-semibold transition-colors ${
                    activeTab === "rewards" ? "bg-rule text-zinc-50" : "text-ash hover:text-paper"
                  }`}
                >
                  Reward History ({data.rewards.length})
                </button>
              </div>

              {activeTab === "citizens" ? (
                <div className="border border-rule rounded-[4px] overflow-hidden">
                  {data.referredCitizens.length === 0 ? (
                    <div className="p-8 text-center text-ash text-[13px]">
                      No citizens have joined using your link yet. Share your code to get started!
                    </div>
                  ) : (
                    <table className="w-full text-[13px] tabular">
                      <thead>
                        <tr className="text-[12px] text-ash text-left border-b border-rule">
                          <th className="py-2.5 pl-4 pr-2 font-normal">Citizen Name</th>
                          <th className="py-2.5 px-2 text-right font-normal">Joined Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.referredCitizens.map((c) => (
                          <tr key={c.id} className="border-b border-rule last:border-0 hover:bg-pane">
                            <td className="py-2.5 pl-4 pr-2 font-semibold text-zinc-100">
                              @{c.username}
                            </td>
                            <td className="py-2.5 px-2 text-right text-ash">
                              {fmtUtcDate(c.joinedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <div className="border border-rule rounded-[4px] overflow-hidden">
                  {data.rewards.length === 0 ? (
                    <div className="p-8 text-center text-ash text-[13px]">
                      No trading commissions generated yet. Gold is credited automatically when your referrals trade!
                    </div>
                  ) : (
                    <table className="w-full text-[13px] tabular">
                      <thead>
                        <tr className="text-[12px] text-ash text-left border-b border-rule">
                          <th className="py-2.5 pl-4 pr-2 font-normal">Date</th>
                          <th className="py-2.5 px-2 font-normal">Citizen</th>
                          <th className="py-2.5 px-2 text-right font-normal">Trade Volume</th>
                          <th className="py-2.5 pl-2 pr-4 text-right font-normal">Your Commission</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.rewards.map((r) => (
                          <tr key={r.id} className="border-b border-rule last:border-0 hover:bg-pane">
                            <td className="py-2.5 pl-4 pr-2 text-ash">
                              {fmtUtcDate(r.createdAt)}
                            </td>
                            <td className="py-2.5 px-2 font-medium text-zinc-100">
                              @{r.referredUsername}
                            </td>
                            <td className="py-2.5 px-2 text-right text-paper">
                              {fmtGold(r.tradeVolume)} gold
                            </td>
                            <td className="py-2.5 pl-2 pr-4 text-right font-bold text-emerald-400">
                              +{fmtGold(r.commissionGold)} gold
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
