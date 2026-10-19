"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import WalletModal from "@/components/WalletModal";
import StockGiftModal from "@/components/StockGiftModal";
import StockGiftsSection from "@/components/StockGiftsSection";
import OpenOrdersTable, { type OpenOrder } from "@/components/OpenOrdersTable";
import { PortfolioPosition } from "@/lib/market";
import { usePoll, stableBody } from "@/hooks/usePoll";
import type { FeedUser } from "@/hooks/useMarketFeed";
import { fmtGold, fmtPrice, fmtQty, fmtPct, fmtSigned, fmtUtcDate, moveColor } from "@/lib/format";
import { Gift } from "lucide-react";

interface PortfolioResponse {
  positions: PortfolioPosition[];
  totalNetWorth: number;
  totalStockValue: number;
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
  const costBasis = positions.reduce((sum, x) => sum + x.costBasis, 0);
  const unrealized = (p?.totalStockValue || 0) - costBasis;
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

            <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-rule rounded-[4px] divide-x divide-y lg:divide-y-0 divide-rule [&>*]:border-rule">
              <Figure label="Net worth" value={p ? `${fmtGold(p.totalNetWorth)} gold` : "–"} />
              <Figure label="Purse" value={p ? `${fmtGold(p.cashBalance)} gold` : "–"} tone="text-bullion" />
              <Figure label="In buy orders" value={p ? `${fmtGold(p.lockedCash)} gold` : "–"} tone="text-paper" />
              <Figure label="Shares value" value={p ? `${fmtGold(p.totalStockValue)} gold` : "–"} tone="text-paper" />
              <Figure label="Unrealized" value={p ? `${unrealized >= 0 ? "+" : "−"}${fmtGold(Math.abs(unrealized))}` : "–"} sub={p ? fmtPct(unrealizedPct) : undefined} tone={moveColor(unrealized)} />
              <Figure label="Dividends received" value={data ? `${fmtPrice(data.totalDividendsEarned)} gold` : "–"} tone="text-paper" />
            </dl>

            <section aria-labelledby="holdings" className="flex flex-col gap-3">
              <h2 id="holdings" className="text-[15px] font-semibold text-zinc-50">
                Holdings <span className="text-ash font-normal">{data ? positions.length : ""}</span>
              </h2>
              <div className="border border-rule rounded-[4px] overflow-x-auto">
                {data && positions.length === 0 ? (
                  <p className="px-4 py-6 text-[13px] text-ash">
                    You don&apos;t hold any shares yet. <Link href="/" className="text-paper underline underline-offset-4">Browse the market</Link> to buy some.
                  </p>
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
                        <th scope="col" className="font-normal py-2.5 pl-2 pr-4 text-right">Gift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos) => (
                        <tr key={pos.companyId} className="border-b border-rule last:border-0 hover:bg-pane">
                          <td className="py-2.5 pl-4 pr-2">
                            <Link href={`/trade/${pos.ticker}`} className="flex flex-col">
                              <span className="condensed font-bold text-[15px] text-zinc-50">{pos.ticker}</span>
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
                          <td className={`py-2.5 px-2 text-right ${moveColor(pos.pnl)}`}>
                            {fmtSigned(pos.pnl)}
                            <span className="block text-[11px]">{fmtPct(pos.pnlPercent)}</span>
                          </td>
                          <td className="py-2.5 pl-2 pr-4 text-right">
                            {pos.availableShares > 0 ? (
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
                            ) : (
                              <span className="text-[11px] text-ash">–</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
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
