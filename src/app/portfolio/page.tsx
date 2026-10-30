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
import { Gift, ShieldCheck } from "lucide-react";
import ShareholderBadgeModal from "@/components/ShareholderBadgeModal";

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

function Figure({ label, value, tone = "text-zinc-50", big = false }: { label: string; value: string; tone?: string; big?: boolean }) {
  return (
    <div className="bg-floor px-3 sm:px-4 py-3 flex flex-col gap-0.5 min-w-0">
      <dt className="text-[12px] text-ash truncate">{label}</dt>
      <dd className={`condensed tabular font-bold truncate leading-tight ${big ? "text-[24px]" : "text-[19px]"} ${tone}`}>{value}</dd>
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
  const [badgeTicker, setBadgeTicker] = useState<string | null>(null);
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

      <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-8">
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
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h1 className="condensed text-[28px] font-extrabold text-zinc-50 leading-none tracking-tight">Portfolio</h1>
                <p className="mt-1.5 text-[13px] text-ash truncate">
                  {user ? `In game as ${user.parlamentumName || user.username}` : " "}
                </p>
              </div>
              <div className="grid grid-cols-3 sm:flex gap-2">
                <button type="button" onClick={() => setWallet("deposit")} className="h-9 px-4 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor text-[13px] font-semibold">
                  Deposit
                </button>
                <button type="button" onClick={() => setWallet("withdraw")} className="h-9 px-4 rounded-[4px] border border-rule hover:border-zinc-500 text-[13px] text-paper">
                  Withdraw
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGiftModalCompany(undefined);
                    setShowGiftModal(true);
                  }}
                  className="h-9 px-4 rounded-[4px] border border-rule hover:border-zinc-500 text-[13px] text-paper flex items-center justify-center gap-1.5"
                >
                  <Gift className="h-3.5 w-3.5 text-ash" />
                  Gift
                </button>
              </div>
            </header>

            <section aria-label="Summary" className="flex flex-col gap-3">
              <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-rule border border-rule rounded-[4px] overflow-hidden">
                <Figure big label="Net worth" value={p ? `${fmtGold(tradingNetWorth + founderStockValue)}` : "–"} />
                <Figure big label="Purse" value={p ? fmtGold(p.cashBalance) : "–"} tone="text-bullion" />
                {founderPositions.length > 0 && (
                  <Figure
                    label={founderPositions.length > 1 ? "Company treasuries" : `${founderPositions[0].ticker} treasury`}
                    value={fmtGold(founderPositions.reduce((sum, x) => sum + (x.treasuryBalance || 0), 0))}
                    tone="text-bullion"
                  />
                )}
                <Figure label="In buy orders" value={p ? fmtGold(p.lockedCash) : "–"} tone="text-paper" />
                <Figure label={founderPositions.length > 0 ? "Traded shares" : "Shares"} value={p ? fmtGold(tradingStockValue) : "–"} tone="text-paper" />
                {founderPositions.length > 0 && <Figure label="Founder shares" value={fmtGold(founderStockValue)} tone="text-paper" />}
                <Figure label="Unrealized" value={p ? `${unrealized >= 0 ? "+" : "−"}${fmtGold(Math.abs(unrealized))} ${fmtPct(unrealizedPct)}` : "–"} tone={moveColor(unrealized)} />
                <Figure label="Dividends received" value={data ? fmtPrice(data.totalDividendsEarned) : "–"} tone="text-paper" />
              </dl>
              <p className="text-[12px] text-ash">All figures in gold. Net worth counts your purse, open buy orders and shares at the last price.</p>
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
            </section>

            <section aria-labelledby="holdings" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="holdings" className="text-[15px] font-semibold text-zinc-50">
                  Holdings{" "}
                  <span className="text-ash font-normal tabular">
                    {holdingsTab === "trading" ? tradingPositions.length : holdingsTab === "founder" ? founderPositions.length : positions.length}
                  </span>
                </h2>
                {founderPositions.length > 0 && (
                  <div role="tablist" aria-label="Holdings" className="flex rounded-[4px] border border-rule p-0.5 text-[13px]">
                    {([
                      ["trading", "Traded"],
                      ["founder", "My companies"],
                      ["all", "All"],
                    ] as const).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={holdingsTab === id}
                        onClick={() => setHoldingsTab(id)}
                        className={`h-7 px-3 rounded-[3px] ${holdingsTab === id ? "bg-rule text-zinc-50 font-semibold" : "text-ash hover:text-paper"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {holdingsTab === "founder" && founderPositions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {founderPositions.map((f) => (
                    <article key={f.companyId} className="border border-rule rounded-[4px] flex flex-col">
                      <header className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/trade/${f.ticker}`} className="condensed text-[20px] font-extrabold text-zinc-50 leading-none">{f.ticker}</Link>
                          <p className="text-[12px] text-ash truncate mt-1">{f.name}</p>
                        </div>
                        <div className="text-right">
                          <div className="condensed tabular text-[20px] font-bold text-zinc-50 leading-none">{fmtGold(f.marketValue)}</div>
                          <div className="text-[12px] text-ash mt-1 tabular">at {fmtPrice(f.currentPrice)}</div>
                        </div>
                      </header>
                      <dl className="px-4 py-2 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] border-t border-rule">
                        <div>
                          <dt className="text-[12px] text-ash">Your shares</dt>
                          <dd className="tabular text-paper">
                            {fmtQty(f.shares)} <span className="text-ash">{f.ownershipPercent !== undefined ? `${f.ownershipPercent.toFixed(1)}%` : ""}</span>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[12px] text-ash">Treasury</dt>
                          <dd className="tabular text-bullion font-semibold">{fmtGold(f.treasuryBalance || 0)} gold</dd>
                        </div>
                        <div>
                          <dt className="text-[12px] text-ash">IPO shares unsold</dt>
                          <dd className="tabular text-paper">{fmtQty(f.lockedShares)} of {fmtQty(f.floatShares || 0)}</dd>
                        </div>
                        <div>
                          <dt className="text-[12px] text-ash">Listing fee paid</dt>
                          <dd className="tabular text-paper">{fmtGold(Number(f.ipoFeeCollected || 0))} of 200</dd>
                        </div>
                      </dl>
                      <div className="mt-auto px-4 py-3 border-t border-rule flex flex-wrap gap-2">
                        <Link href={`/trade/${f.ticker}?tab=founder`} className="h-8 px-3 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor text-[13px] font-semibold flex items-center">
                          Founder tools
                        </Link>
                        <button type="button" onClick={() => setBadgeTicker(f.ticker)} className="h-8 px-3 rounded-[4px] border border-bullion/40 text-bullion hover:bg-bullion/10 text-[13px] font-medium flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Badge
                        </button>
                        <Link href={`/company/${f.ticker}/ledger`} className="h-8 px-3 rounded-[4px] border border-rule hover:border-zinc-500 text-[13px] text-paper flex items-center">
                          Ledger
                        </Link>
                        <Link href={`/trade/${f.ticker}`} className="h-8 px-3 rounded-[4px] border border-rule hover:border-zinc-500 text-[13px] text-paper flex items-center">
                          Trade
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="border border-rule rounded-[4px] overflow-hidden">
                  {data && (holdingsTab === "trading" ? tradingPositions.length === 0 : positions.length === 0) ? (
                    <div className="px-4 py-8 flex flex-col items-start gap-2">
                      <p className="text-[13px] text-ash">You don&apos;t hold any shares yet.</p>
                      <Link href="/" className="text-[13px] text-paper underline underline-offset-4">Browse the market</Link>
                    </div>
                  ) : (
                    <table className="w-full text-[13px] tabular">
                      <thead>
                        <tr className="text-[12px] text-ash text-left border-b border-rule">
                          <th scope="col" className="font-normal py-2.5 pl-3 sm:pl-4 pr-2">Company</th>
                          <th scope="col" className="font-normal py-2.5 px-2 text-right">Shares</th>
                          <th scope="col" className="font-normal py-2.5 px-2 text-right hidden sm:table-cell">Average</th>
                          <th scope="col" className="font-normal py-2.5 px-2 text-right hidden sm:table-cell">Last</th>
                          <th scope="col" className="font-normal py-2.5 px-2 text-right hidden md:table-cell">Value</th>
                          <th scope="col" className="font-normal py-2.5 pl-2 pr-3 sm:px-2 text-right">Unrealized</th>
                          <th scope="col" className="font-normal py-2.5 pl-2 pr-4 text-right hidden sm:table-cell"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(holdingsTab === "trading" ? tradingPositions : positions).map((pos) => (
                          <tr key={pos.companyId} className="border-b border-rule last:border-0 hover:bg-pane">
                            <td className="py-2.5 pl-3 sm:pl-4 pr-2">
                              <Link href={`/trade/${pos.ticker}`} className="flex flex-col min-w-0">
                                <span className="flex items-center gap-1.5">
                                  <span className="condensed font-bold text-[15px] text-zinc-50">{pos.ticker}</span>
                                  {pos.isCreator && <span className="text-[11px] text-bullion">founder</span>}
                                </span>
                                <span className="text-[12px] text-ash truncate max-w-[130px] sm:max-w-[220px]">{pos.name}</span>
                              </Link>
                            </td>
                            <td className="py-2.5 px-2 text-right text-zinc-50">
                              {fmtQty(pos.shares)}
                              {pos.lockedShares > 0 && <span className="block text-[11px] text-ash">{fmtQty(pos.lockedShares)} selling</span>}
                            </td>
                            <td className="py-2.5 px-2 text-right text-paper hidden sm:table-cell">{fmtPrice(pos.avgBuyPrice)}</td>
                            <td className="py-2.5 px-2 text-right text-zinc-50 hidden sm:table-cell">{fmtPrice(pos.currentPrice)}</td>
                            <td className="py-2.5 px-2 text-right text-paper hidden md:table-cell">{fmtGold(pos.marketValue)}</td>
                            <td className={`py-2.5 pl-2 pr-3 sm:px-2 text-right ${moveColor(pos.pnl)}`}>
                              {fmtSigned(pos.pnl)}
                              <span className="block text-[11px]">{fmtPct(pos.pnlPercent)}</span>
                            </td>
                            <td className="py-2.5 pl-2 pr-4 text-right hidden sm:table-cell">
                              {pos.availableShares > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGiftModalCompany(pos.companyId);
                                    setShowGiftModal(true);
                                  }}
                                  className="h-7 px-2.5 rounded-[3px] border border-rule hover:border-zinc-500 text-[12px] text-paper inline-flex items-center gap-1"
                                  title="Gift some of these shares"
                                >
                                  <Gift className="h-3 w-3 text-ash" />
                                  Gift
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setBadgeTicker(pos.ticker)}
                                className="h-7 px-2.5 rounded-[3px] border border-bullion/40 text-bullion hover:bg-bullion/10 text-[12px] inline-flex items-center gap-1 ml-1.5"
                                title="View & share verified shareholder card"
                              >
                                <ShieldCheck className="h-3 w-3" />
                                Badge
                              </button>
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

      {badgeTicker && user && (
        <ShareholderBadgeModal
          ticker={badgeTicker}
          username={user.username}
          onClose={() => setBadgeTicker(null)}
        />
      )}
    </div>
  );
}
