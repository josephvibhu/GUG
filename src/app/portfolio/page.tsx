"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import WalletModal from "@/components/WalletModal";
import StockGiftModal from "@/components/StockGiftModal";
import StockGiftsSection from "@/components/StockGiftsSection";
import OpenOrdersTable, { type OpenOrder } from "@/components/OpenOrdersTable";
import PortfolioPnLCard from "@/components/PortfolioPnLCard";
import { PortfolioPosition } from "@/lib/market";
import { usePoll, stableBody } from "@/hooks/usePoll";
import type { FeedUser } from "@/hooks/useMarketFeed";
import { fmtGold, fmtPrice, fmtQty, fmtPct, fmtSigned, fmtUtcDate, moveColor } from "@/lib/format";
import { Gift, Building2, TrendingUp, Layers, ShieldCheck } from "lucide-react";

interface PortfolioResponse {
  positions: PortfolioPosition[];
  tradingPositions?: PortfolioPosition[];
  founderPositions?: PortfolioPosition[];
  totalNetWorth: number;
  tradingNetWorth?: number;
  totalStockValue: number;
  tradingStockValue?: number;
  founderStockValue?: number;
  cashBalance: number;
  lockedCash: number;
}

interface Payout {
  id: string;
  ticker: string;
  companyName: string;
  sharesCount: number;
  dividendPerShare: number;
  payoutAmount: number;
  createdAt: string;
}

interface PortfolioData {
  user: FeedUser;
  portfolio: PortfolioResponse;
  openOrders: OpenOrder[];
  dividendHistory: Payout[];
  totalDividendsEarned: number;
}

function Figure({ label, value, sub, tone = "text-zinc-50" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="px-4 py-3 flex flex-col gap-0.5 min-w-0">
      <dt className="text-[12px] text-ash">{label}</dt>
      <dd className={`text-[17px] font-semibold truncate ${tone}`}>
        {value}
        {sub && <span className="ml-1.5 text-[12px] font-normal">{sub}</span>}
      </dd>
    </div>
  );
}

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);
  const [wallet, setWallet] = useState<"deposit" | "withdraw" | null>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftModalCompany, setGiftModalCompany] = useState<string | undefined>(undefined);
  const [holdingsTab, setHoldingsTab] = useState<"trading" | "founder" | "all">("trading");
  const lastBody = useRef("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch("/api/portfolio", { cache: "no-store", signal });
    if (res.status === 401) {
      setLoggedOut(true);
      return;
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "portfolio failed");
    const body = stableBody(json);
    if (body !== lastBody.current) {
      lastBody.current = body;
      setLoggedOut(false);
      setData(json);
    }
  }, []);

  // Holdings only change when you trade or a dividend lands; trades and deposits refresh it at once
  usePoll(load, 10000);
  const refresh = useCallback(() => window.dispatchEvent(new Event("wallet_updated")), []);

  const p = data?.portfolio;
  const user = data?.user;
  const positions = p?.positions || [];
  const tradingPositions = p?.tradingPositions || positions.filter((x) => !x.isCreator);
  const founderPositions = p?.founderPositions || positions.filter((x) => x.isCreator);
  const tradingStockValue = p?.tradingStockValue !== undefined ? p.tradingStockValue : tradingPositions.reduce((sum, x) => sum + x.marketValue, 0);
  const founderStockValue = p?.founderStockValue !== undefined ? p.founderStockValue : founderPositions.reduce((sum, x) => sum + x.marketValue, 0);
  const tradingNetWorth = p?.tradingNetWorth !== undefined ? p.tradingNetWorth : Math.round(((p?.cashBalance || 0) + (p?.lockedCash || 0) + tradingStockValue) * 100) / 100;

  // Trader P&L is calculated on active market investments
  const pnlPositions = tradingPositions.length > 0 ? tradingPositions : positions;
  const costBasis = pnlPositions.reduce((sum, x) => sum + x.costBasis, 0);
  const pnlStockValue = tradingPositions.length > 0 ? tradingStockValue : (p?.totalStockValue || 0);
  const unrealized = pnlStockValue - costBasis;
  const unrealizedPct = costBasis > 0 ? (unrealized / costBasis) * 100 : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onUserRefresh={refresh} />

      <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {loggedOut ? (
          <div className="flex flex-col items-start gap-3 py-10">
            <h1 className="condensed text-[28px] font-extrabold text-zinc-50 leading-none">Portfolio</h1>
            <p className="text-sm text-ash">Log in to see your shares, open orders and dividends.</p>
            <Link href="/login" className="h-9 px-4 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor text-[13px] font-semibold flex items-center">
              Log in
            </Link>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h1 className="condensed text-[28px] font-extrabold text-zinc-50 leading-none tracking-tight truncate">
                  Portfolio
                </h1>
                <p className="mt-1.5 text-[13px] text-ash">
                  {user ? `${user.displayName || user.username} • In game as ${user.parlamentumName || user.username}` : " "}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGiftModalCompany(undefined);
                    setShowGiftModal(true);
                  }}
                  className="h-9 px-3.5 rounded-[4px] border border-bullion/50 hover:bg-bullion/10 text-[13px] text-bullion font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Gift className="w-3.5 h-3.5" />
                  Gift stock
                </button>
                <button type="button" onClick={() => setWallet("deposit")} className="h-9 px-4 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor text-[13px] font-semibold">
                  Deposit gold
                </button>
                <button type="button" onClick={() => setWallet("withdraw")} className="h-9 px-4 rounded-[4px] border border-rule hover:border-zinc-500 text-[13px] text-paper">
                  Withdraw gold
                </button>
              </div>
            </header>

            {p && (
              <PortfolioPnLCard
                user={user}
                positions={pnlPositions}
                cashBalance={p.cashBalance}
                lockedCash={p.lockedCash}
                totalStockValue={pnlStockValue}
                totalNetWorth={tradingNetWorth}
                totalDividendsEarned={data ? data.totalDividendsEarned : 0}
              />
            )}

            <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-rule rounded-[4px] divide-x divide-y lg:divide-y-0 divide-rule [&>*]:border-rule">
              <Figure 
                label={founderPositions.length > 0 ? "Trading Net Worth" : "Net worth"} 
                value={p ? `${fmtGold(tradingNetWorth)} gold` : "–"} 
                sub={founderPositions.length > 0 ? `+${fmtGold(founderStockValue)}g founder equity` : undefined} 
              />
              <Figure label="Purse" value={p ? `${fmtGold(p.cashBalance)} gold` : "–"} tone="text-bullion" />
              <Figure label="In buy orders" value={p ? `${fmtGold(p.lockedCash)} gold` : "–"} tone="text-paper" />
              <Figure label={founderPositions.length > 0 ? "Trading stocks" : "Shares value"} value={p ? `${fmtGold(tradingStockValue)} gold` : "–"} tone="text-paper" />
              <Figure label="Unrealized" value={p ? `${unrealized >= 0 ? "+" : "−"}${fmtGold(Math.abs(unrealized))}` : "–"} sub={p ? fmtPct(unrealizedPct) : undefined} tone={moveColor(unrealized)} />
              <Figure label="Dividends received" value={data ? `${fmtPrice(data.totalDividendsEarned)} gold` : "–"} tone="text-paper" />
            </dl>

            <section aria-labelledby="holdings" className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rule pb-3">
                <div className="flex items-center gap-2">
                  <h2 id="holdings" className="text-[15px] font-semibold text-zinc-50">
                    Holdings
                  </h2>
                  <span className="text-xs text-ash font-mono">
                    ({holdingsTab === "trading" ? tradingPositions.length : holdingsTab === "founder" ? founderPositions.length : positions.length} {holdingsTab === "founder" ? "companies" : "positions"})
                  </span>
                </div>

                {founderPositions.length > 0 && (
                  <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-rule rounded-lg">
                    <button
                      type="button"
                      onClick={() => setHoldingsTab("trading")}
                      className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                        holdingsTab === "trading"
                          ? "bg-bullion text-floor shadow"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Trading Portfolio ({tradingPositions.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHoldingsTab("founder")}
                      className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                        holdingsTab === "founder"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Founder & Company Equity ({founderPositions.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHoldingsTab("all")}
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
                        holdingsTab === "all"
                          ? "bg-zinc-800 text-white"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>All</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Founder Holdings Dedicated Enterprise View */}
              {holdingsTab === "founder" && founderPositions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {founderPositions.map((fPos) => (
                    <div
                      key={fPos.companyId}
                      className="p-5 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-amber-950/20 border border-amber-500/30 flex flex-col justify-between gap-4 shadow-xl"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xl font-black text-amber-400">${fPos.ticker}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                👑 Founder Equity
                              </span>
                            </div>
                            <h3 className="text-sm font-bold text-white mt-1">{fPos.name}</h3>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-zinc-400 block font-sans">Market Valuation</span>
                            <span className="font-mono text-base font-black text-emerald-400">
                              {fmtGold(fPos.marketValue)} gold
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono block">@ {fmtPrice(fPos.currentPrice)}g / sh</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-800/80 font-mono text-[11px]">
                          <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/60">
                            <span className="text-zinc-400 text-[10px] font-sans block">Controlling Stake</span>
                            <span className="text-paper font-bold text-xs">{fmtQty(fPos.shares)} sh</span>
                            <span className="text-[10px] text-amber-400 block mt-0.5">
                              {fPos.ownershipPercent !== undefined ? `${fPos.ownershipPercent.toFixed(1)}% ownership` : "Controlling"}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/60">
                            <span className="text-zinc-400 text-[10px] font-sans block">Primary Float for Sale</span>
                            <span className="text-paper font-bold text-xs">
                              {fPos.lockedShares > 0 ? `${fmtQty(fPos.lockedShares)} sh in IPO order` : "Float open"}
                            </span>
                            <span className="text-[10px] text-zinc-400 block mt-0.5">
                              Total Float: {fmtQty(fPos.floatShares || 1000)} sh
                            </span>
                          </div>
                        </div>

                        {/* Underwriting Charter Fee status */}
                        <div className="mt-3 p-2.5 rounded-lg bg-zinc-950/50 border border-zinc-800/60 flex items-center justify-between text-[11px] font-mono">
                          <div>
                            <span className="text-zinc-400 font-sans block text-[10px]">IPO Charter Underwriting</span>
                            <span className="text-zinc-300">200g deducted from float capital</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            {Number(fPos.ipoFeeCollected || 0).toFixed(1)}g / 200g collected
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/60">
                        <Link
                          href={`/trade/${fPos.ticker}`}
                          className="flex-1 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white text-center transition"
                        >
                          Trade Terminal
                        </Link>
                        <Link
                          href="/dividends"
                          className="py-2 px-3 rounded-lg bg-bullion hover:bg-amber-300 text-xs font-semibold text-floor transition"
                        >
                          Declare Dividend
                        </Link>
                        <Link
                          href={`/companies/${fPos.ticker}`}
                          className="py-2 px-3 rounded-lg border border-rule hover:border-zinc-500 text-xs text-paper transition"
                        >
                          Company Ledger
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-rule rounded-[4px] overflow-x-auto">
                  {data && (holdingsTab === "trading" ? tradingPositions.length === 0 : positions.length === 0) ? (
                    <div className="px-4 py-8 text-center flex flex-col items-center gap-2">
                      <p className="text-[13px] text-ash">
                        {holdingsTab === "trading"
                          ? "You don't hold any speculative market shares yet."
                          : "You don't hold any shares yet."}
                      </p>
                      <Link href="/" className="text-xs font-semibold text-bullion hover:underline underline-offset-4">
                        Browse the market to invest in companies →
                      </Link>
                    </div>
                  ) : (
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="text-[12px] text-ash text-left border-b border-rule">
                          <th scope="col" className="font-normal py-2.5 pl-4 pr-2">Company</th>
                          <th scope="col" className="font-normal py-2.5 px-2 text-right">Shares</th>
                          <th scope="col" className="font-normal py-2.5 px-2 text-right hidden sm:table-cell">Average</th>
                          <th scope="col" className="font-normal py-2.5 px-2 text-right">Last</th>
                          <th scope="col" className="font-normal py-2.5 px-2 text-right hidden md:table-cell">Value</th>
                          <th scope="col" className="font-normal py-2.5 px-2 text-right">Unrealized</th>
                          <th scope="col" className="font-normal py-2.5 pl-2 pr-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(holdingsTab === "trading" ? tradingPositions : holdingsTab === "founder" ? founderPositions : positions).map((pos) => (
                          <tr key={pos.companyId} className="border-b border-rule last:border-0 hover:bg-pane">
                            <td className="py-2.5 pl-4 pr-2">
                              <Link href={`/trade/${pos.ticker}`} className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="condensed font-bold text-[15px] text-zinc-50">{pos.ticker}</span>
                                  {pos.isCreator && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      👑 Founder
                                    </span>
                                  )}
                                </div>
                                <span className="text-[12px] text-ash truncate max-w-[200px]">{pos.name}</span>
                              </Link>
                            </td>
                            <td className="py-2.5 px-2 text-right text-zinc-50">
                              {fmtQty(pos.shares)}
                              {pos.lockedShares > 0 && <span className="block text-[11px] text-ash">{fmtQty(pos.lockedShares)} in sell orders</span>}
                            </td>
                            <td className="py-2.5 px-2 text-right text-paper hidden sm:table-cell">{fmtPrice(pos.avgBuyPrice)}</td>
                            <td className="py-2.5 px-2 text-right text-zinc-50">{fmtPrice(pos.currentPrice)}</td>
                            <td className="py-2.5 px-2 text-right text-paper hidden md:table-cell">{fmtGold(pos.marketValue)}</td>
                            <td className="py-2.5 px-2 text-right">
                              <div className="flex flex-col items-end">
                                <span className={`font-mono font-bold text-[12px] ${moveColor(pos.pnl)}`}>
                                  {fmtSigned(pos.pnl)} gold
                                </span>
                                <span className={`inline-block text-[10px] font-mono px-1.5 py-0.5 rounded font-bold mt-0.5 ${
                                  pos.pnl > 0 
                                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                                    : pos.pnl < 0 
                                      ? "bg-rose-500/15 text-rose-400 border border-rose-500/30" 
                                      : "text-ash bg-zinc-800"
                                }`}>
                                  {fmtPct(pos.pnlPercent)}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 pl-2 pr-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  href={`/trade/${pos.ticker}`}
                                  className="px-2 py-0.5 rounded-[3px] bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-200 transition-colors font-medium"
                                >
                                  Trade
                                </Link>
                                {pos.availableShares > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setGiftModalCompany(pos.companyId);
                                      setShowGiftModal(true);
                                    }}
                                    className="px-2 py-0.5 rounded-[3px] bg-pane border border-rule hover:border-bullion/60 text-[11px] text-paper hover:text-bullion transition-colors inline-flex items-center gap-1 cursor-pointer"
                                    title="Create a gift coupon code from these shares"
                                  >
                                    <Gift className="w-3 h-3 text-bullion" />
                                    Gift
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </section>

            <StockGiftsSection
              onPortfolioRefresh={refresh}
              openCreateModal={() => {
                setGiftModalCompany(undefined);
                setShowGiftModal(true);
              }}
            />

            <section aria-labelledby="orders" className="flex flex-col gap-3">
              <h2 id="orders" className="text-[15px] font-semibold text-zinc-50">
                Open orders <span className="text-ash font-normal">{data ? data.openOrders.length : ""}</span>
              </h2>
              <div className="border border-rule rounded-[4px]">
                {data && <OpenOrdersTable orders={data.openOrders} onOrderCancelled={refresh} showTicker />}
              </div>
            </section>

            <section aria-labelledby="payouts" className="flex flex-col gap-3">
              <h2 id="payouts" className="text-[15px] font-semibold text-zinc-50">Dividends received</h2>
              <div className="border border-rule rounded-[4px] overflow-x-auto">
                {data && data.dividendHistory.length === 0 ? (
                  <p className="px-4 py-6 text-[13px] text-ash">
                    None yet. Companies pay their dividends on Fridays at 00:00 UTC to whoever holds shares then.
                  </p>
                ) : (
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-[12px] text-ash text-left border-b border-rule">
                        <th scope="col" className="font-normal py-2.5 pl-4 pr-2">Paid</th>
                        <th scope="col" className="font-normal py-2.5 px-2">Company</th>
                        <th scope="col" className="font-normal py-2.5 px-2 text-right hidden sm:table-cell">Shares</th>
                        <th scope="col" className="font-normal py-2.5 px-2 text-right hidden sm:table-cell">Per share</th>
                        <th scope="col" className="font-normal py-2.5 pl-2 pr-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.dividendHistory || []).map((d) => (
                        <tr key={d.id} className="border-b border-rule last:border-0">
                          <td className="py-2.5 pl-4 pr-2 text-ash whitespace-nowrap">{fmtUtcDate(d.createdAt)}</td>
                          <td className="py-2.5 px-2">
                            <Link href={`/trade/${d.ticker}`} className="condensed font-bold text-zinc-50">{d.ticker}</Link>
                          </td>
                          <td className="py-2.5 px-2 text-right text-paper hidden sm:table-cell">{fmtQty(d.sharesCount)}</td>
                          <td className="py-2.5 px-2 text-right text-paper hidden sm:table-cell">{d.dividendPerShare.toFixed(4)}</td>
                          <td className="py-2.5 pl-2 pr-4 text-right text-bullion">{fmtPrice(d.payoutAmount)} gold</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {wallet && (
        <WalletModal key={wallet} isOpen initialTab={wallet} onClose={() => setWallet(null)} onBalanceUpdated={refresh} />
      )}

      {showGiftModal && (
        <StockGiftModal
          isOpen={showGiftModal}
          onClose={() => setShowGiftModal(false)}
          positions={positions}
          initialCompanyId={giftModalCompany}
          onGiftCreated={refresh}
        />
      )}
    </div>
  );
}
