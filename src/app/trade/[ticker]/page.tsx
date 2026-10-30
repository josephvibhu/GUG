"use client";

import { use, useCallback, useRef, useState, useSyncExternalStore, Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import Navbar from "@/components/Navbar";
import OrderBook from "@/components/OrderBook";
import TradeForm from "@/components/TradeForm";
import RecentTrades from "@/components/RecentTrades";
import OpenOrdersTable, { type OpenOrder } from "@/components/OpenOrdersTable";
import { BuybackDialog, EarningsDialog, TreasuryPanel, CompanyProfileForm } from "@/components/FounderTools";
import CompanyLedger from "@/components/CompanyLedger";
import CompanyGovernance from "@/components/CompanyGovernance";
import { Company, OrderBookData, TradeItem, PortfolioPosition } from "@/lib/market";
import { usePoll, stableBody } from "@/hooks/usePoll";
import { useMarketFeed, type FeedUser } from "@/hooks/useMarketFeed";
import { fmtPrice, fmtPct, fmtSigned, fmtCompact, fmtQty, fmtGold, fmtUtcDate, moveColor } from "@/lib/format";

// The chart library is the heaviest part of the page (~60 KB gzipped): load it alongside the data
// instead of before anything can render
const TVChart = dynamic(() => import("@/components/TVChart"), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-sm text-ash">Loading chart…</div>,
});

interface Holder {
  userId: string;
  username: string;
  displayName: string;
  shares: number;
  equityPercent: number;
}

interface Report {
  id: string;
  periodTitle: string;
  netProfit: number;
  dividendPool: number;
  dividendPerShare: number;
  status: "SCHEDULED" | "DISTRIBUTED" | "CANCELLED";
  scheduledFor: string;
  distributedAt?: string;
  totalDistributed: number;
  notes?: string;
}

interface TerminalData {
  company: Company;
  orderBook: OrderBookData;
  recentTrades: TradeItem[];
  lastTradeId: string | null;
  serverNow: number;
  user: FeedUser | null;
  userHolding: PortfolioPosition | null;
  userOrders: OpenOrder[];
  marketSchedule: { isOpen: boolean; statusText: string } | null;
  earningsReports: Report[];
  nextFriday: string;
  shareholders: Holder[];
  founderView: { discordHandle: string } | null;
}

type Tab = "book" | "trades" | "orders" | "position" | "holders" | "dividends" | "governance" | "ledger" | "about" | "founder";

// Desktop layout switch read from CSS media, so the default tab suits the screen (false on the server)
const LG = "(min-width: 1024px)";
const subscribeLg = (cb: () => void) => {
  const m = window.matchMedia(LG);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useIsLg = () => useSyncExternalStore(subscribeLg, () => window.matchMedia(LG).matches, () => false);

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] text-ash">{label}</dt>
      <dd className="text-[13px] text-paper whitespace-nowrap">{value}</dd>
    </div>
  );
}

function Terminal({ ticker }: { ticker: string }) {
  const router = useRouter();
  const { companies } = useMarketFeed();
  const isLg = useIsLg();
  const [data, setData] = useState<TerminalData | null>(null);
  const [missing, setMissing] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab | null>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "founder" ? "founder" : null
  );
  const [dialog, setDialog] = useState<"buyback" | "earnings" | null>(null);
  const lastBody = useRef("");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const res = await fetch(`/api/market/${ticker}`, { cache: "no-store", signal });
      if (res.status === 404) {
        setMissing(true);
        return;
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "terminal load failed");
      // Skip the re-render when nothing changed (most polls on a quiet market)
      const body = stableBody(json, ["serverNow", "currentUTC", "timeRemainingSeconds", "timeRemainingFormatted"]);
      if (body !== lastBody.current) {
        lastBody.current = body;
        setData(json);
      }
    },
    [ticker]
  );

  // 3 s while the floor is open, 15 s while closed; paused in background tabs
  usePoll(load, data?.marketSchedule?.isOpen === false ? 15000 : 3000, ticker);
  const refresh = useCallback(() => window.dispatchEvent(new Event("wallet_updated")), []);

  if (missing) {
    return (
      <main className="flex-1 flex flex-col items-start gap-3 px-6 py-16 max-w-xl mx-auto w-full">
        <h1 className="text-xl font-semibold text-zinc-50">{ticker} isn&apos;t listed.</h1>
        <p className="text-sm text-ash">Check the ticker, or pick a company from the market list.</p>
        <Link href="/" className="h-9 px-4 rounded-[4px] border border-rule text-[13px] text-paper flex items-center hover:border-zinc-500">
          Back to markets
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex-1 flex flex-col">
        <div className="h-[61px] border-b border-rule" />
        <div className="flex-1 grid lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-[420px] lg:h-[min(64vh,640px)] border-b lg:border-r border-rule flex items-center justify-center text-sm text-ash">
            Loading {ticker}…
          </div>
        </div>
      </main>
    );
  }

  const c = data.company;
  const trades = data.recentTrades || [];
  const lastDirection: "up" | "down" | "flat" =
    trades.length > 1 ? (trades[0].price > trades[1].price ? "up" : trades[0].price < trades[1].price ? "down" : "flat") : "flat";
  const freshTrade = trades[0] && data.serverNow - Date.parse(trades[0].timestamp) < 6000;
  const prevRef = c.currentPrice / (1 + c.change24h / 100);
  const isFounder = !!data.user && (c.creatorId === data.user.id || c.coFounderId === data.user.id);
  const canFound = isFounder || !!data.user?.isAdmin;
  const dividendDue = data.earningsReports.filter((r) => r.status === "SCHEDULED").reduce((sum, r) => sum + r.dividendPool, 0);
  const founderShares = data.shareholders
    .filter((h) => h.userId === c.creatorId || h.userId === c.coFounderId)
    .reduce((sum, h) => sum + h.shares, 0);
  const latestReport = data.earningsReports[0];

  const tabs: { id: Tab; label: string; mobileOnly?: boolean }[] = [
    { id: "book", label: "Book", mobileOnly: true },
    { id: "trades", label: "Trades", mobileOnly: true },
    { id: "orders", label: `Open orders${data.userOrders.length ? ` ${data.userOrders.length}` : ""}` },
    { id: "position", label: "Position" },
    { id: "holders", label: "Holders" },
    { id: "dividends", label: "Dividends" },
    { id: "governance", label: "Governance" },
    { id: "ledger", label: "Ledger" },
    { id: "about", label: "About" },
    ...(canFound ? [{ id: "founder" as Tab, label: "Founder" }] : []),
  ];
  let active: Tab = tab ?? (isLg ? "orders" : "book");
  if (isLg && (active === "book" || active === "trades")) active = "orders";

  return (
    <main className="flex-1 flex flex-col">
      {/* Instrument bar */}
      <div className="border-b border-rule px-3 sm:px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-9 w-9 shrink-0 rounded-[4px] bg-pane border border-rule flex items-center justify-center text-lg" aria-hidden>
            {c.logoUrl}
          </span>
          <div className="relative">
            <span className="flex items-center gap-1">
              <span className="condensed text-[24px] leading-none font-extrabold text-zinc-50 tracking-tight">{c.ticker}</span>
              {companies.length > 1 && <ChevronDown className="h-4 w-4 text-ash" />}
            </span>
            {companies.length > 1 && (
              <select
                aria-label="Switch company"
                value={c.ticker}
                onChange={(e) => router.push(`/trade/${e.target.value}`)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              >
                {companies.map((x) => (
                  <option key={x.id} value={x.ticker}>
                    {x.ticker} ({x.name})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="min-w-0 hidden sm:block">
            <div className="text-[13px] text-paper truncate max-w-[240px]">{c.name}</div>
            <div className="text-[11px] text-ash">{c.sector}</div>
          </div>
          {c.status !== "ACTIVE" && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-[3px] border border-bear/50 text-bear">{c.status === "HALTED" ? "Halted" : "Defaulted"}</span>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span
            key={data.lastTradeId || "none"}
            className={`condensed text-[26px] leading-none font-bold px-1 -mx-1 rounded-[3px] ${
              lastDirection === "up" ? "text-bull" : lastDirection === "down" ? "text-bear" : "text-zinc-50"
            } ${freshTrade ? (lastDirection === "down" ? "tick-down" : "tick-up") : ""}`}
          >
            {fmtPrice(c.currentPrice)}
          </span>
          <span className={`text-[13px] ${moveColor(c.change24h)}`}>
            {fmtSigned(c.currentPrice - prevRef)} {fmtPct(c.change24h)}
          </span>
        </div>

        <dl className="flex flex-wrap gap-x-5 gap-y-1">
          <Stat label="24h high" value={fmtPrice(c.high24h)} />
          <Stat label="24h low" value={fmtPrice(c.low24h)} />
          <Stat label="24h volume" value={`${fmtCompact(c.volume24h)} gold`} />
          <Stat label="Market cap" value={`${fmtCompact(c.marketCap)} gold`} />
          {c.weeklyRevenue ? <Stat label="Revenue / week" value={`${fmtCompact(c.weeklyRevenue)} gold`} /> : null}
        </dl>
      </div>

      {/* Terminal grid: chart | book | ticket, then tabs | trades */}
      <div
        className="flex-1 grid grid-cols-1
          lg:grid-cols-[minmax(0,1fr)_320px] lg:[grid-template-areas:'chart_ticket'_'tabs_book'_'tabs_trades']
          xl:grid-cols-[minmax(0,1fr)_272px_320px] xl:[grid-template-areas:'chart_book_ticket'_'tabs_trades_trades']"
      >
        <section aria-label="Price chart" className="lg:[grid-area:chart] h-[380px] sm:h-[440px] lg:h-[min(66vh,660px)] lg:min-h-[480px] border-b border-rule lg:border-r">
          <TVChart key={c.ticker} ticker={c.ticker} name={c.name} lastTradeId={data.lastTradeId} />
        </section>

        <aside aria-label="Place an order" className="lg:[grid-area:ticket] border-b border-rule">
          <TradeForm
            company={c}
            userHolding={data.userHolding}
            userCash={data.user?.cashBalance || 0}
            loggedIn={!!data.user}
            selectedPrice={selectedPrice}
            orderBook={data.orderBook}
            marketSchedule={data.marketSchedule}
            onTradeSuccess={refresh}
          />
        </aside>

        <section aria-label="Order book" className="lg:[grid-area:book] hidden lg:flex flex-col border-b border-rule xl:border-r">
          <OrderBook orderBook={data.orderBook} ticker={c.ticker} lastDirection={lastDirection} onSelectPrice={setSelectedPrice} />
        </section>

        <section aria-label="Details" className="lg:[grid-area:tabs] lg:border-r border-rule min-w-0">
          <div className="h-10 flex items-stretch gap-1 px-2 border-b border-rule overflow-x-auto" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active === t.id}
                onClick={() => setTab(t.id)}
                className={`px-2.5 text-[13px] whitespace-nowrap border-b-2 -mb-px transition-colors ${t.mobileOnly ? "lg:hidden" : ""} ${
                  active === t.id ? "text-zinc-50 border-zinc-50" : "text-ash border-transparent hover:text-paper"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="min-h-[220px]">
            {active === "book" && (
              <OrderBook orderBook={data.orderBook} ticker={c.ticker} lastDirection={lastDirection} onSelectPrice={setSelectedPrice} showTitle={false} />
            )}
            {active === "trades" && <RecentTrades trades={trades} showTitle={false} />}
            {active === "orders" &&
              (data.user ? (
                <OpenOrdersTable orders={data.userOrders} onOrderCancelled={refresh} />
              ) : (
                <p className="px-4 py-6 text-[13px] text-ash">
                  <Link href="/login" className="text-paper underline underline-offset-4">Log in</Link> to see your orders.
                </p>
              ))}

            {active === "position" &&
              (data.userHolding ? (
                <dl className="px-4 py-4 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                  <Stat label="Shares" value={fmtQty(data.userHolding.shares)} />
                  <Stat label="Free to sell" value={fmtQty(data.userHolding.availableShares)} />
                  <Stat label="In sell orders" value={fmtQty(data.userHolding.lockedShares)} />
                  <Stat label="Average price" value={fmtPrice(data.userHolding.avgBuyPrice)} />
                  <Stat label="Value" value={`${fmtPrice(data.userHolding.marketValue)} gold`} />
                  <div className="flex flex-col">
                    <dt className="text-[11px] text-ash">Unrealized</dt>
                    <dd className={`text-[13px] ${moveColor(data.userHolding.pnl)}`}>
                      {fmtSigned(data.userHolding.pnl)} ({fmtPct(data.userHolding.pnlPercent)})
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="px-4 py-6 text-[13px] text-ash">You don&apos;t hold {c.ticker}.</p>
              ))}

            {active === "holders" && (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-ash text-left">
                    <th scope="col" className="font-normal py-2 pl-4 pr-2">Holder</th>
                    <th scope="col" className="font-normal py-2 px-2 text-right">Shares</th>
                    <th scope="col" className="font-normal py-2 px-2 text-right">Of company</th>
                    <th scope="col" className="font-normal py-2 pl-2 pr-4 text-right hidden sm:table-cell">Last dividend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shareholders.map((h) => (
                    <tr key={h.userId} className="border-t border-rule">
                      <td className="py-2 pl-4 pr-2">
                        <span className="text-paper">{h.displayName}</span>
                        {(h.userId === c.creatorId || h.userId === c.coFounderId) && <span className="ml-2 text-[11px] text-bullion">founder</span>}
                      </td>
                      <td className="py-2 px-2 text-right text-zinc-50">{fmtQty(h.shares)}</td>
                      <td className="py-2 px-2 text-right text-paper">{h.equityPercent.toFixed(2)}%</td>
                      <td className="py-2 pl-2 pr-4 text-right text-ash hidden sm:table-cell">
                        {latestReport ? `${fmtPrice(h.shares * latestReport.dividendPerShare)} gold` : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {active === "dividends" && (
              <div className="flex flex-col">
                <p className="px-4 py-3 text-[13px] text-ash border-b border-rule">
                  {c.ticker} pays dividends of reported net profit to shareholders every Friday at 00:00 UTC as declared by the corporate board.
                  {data.nextFriday && ` Next payout: ${new Date(data.nextFriday).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}.`}
                  {` Paid so far: ${fmtGold(c.totalDividendsPaid || 0)} gold.`}
                </p>
                {data.earningsReports.length === 0 ? (
                  <p className="px-4 py-6 text-[13px] text-ash">No earnings reported yet.</p>
                ) : (
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-ash text-left">
                        <th scope="col" className="font-normal py-2 pl-4 pr-2">Period</th>
                        <th scope="col" className="font-normal py-2 px-2 text-right">Net profit</th>
                        <th scope="col" className="font-normal py-2 px-2 text-right">Dividend</th>
                        <th scope="col" className="font-normal py-2 px-2 text-right hidden sm:table-cell">Per share</th>
                        <th scope="col" className="font-normal py-2 pl-2 pr-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.earningsReports.map((r) => (
                        <tr key={r.id} className="border-t border-rule">
                          <td className="py-2 pl-4 pr-2 text-paper">{r.periodTitle}</td>
                          <td className="py-2 px-2 text-right text-paper">{fmtGold(r.netProfit)}</td>
                          <td className="py-2 px-2 text-right text-bullion">{fmtPrice(r.dividendPool)}</td>
                          <td className="py-2 px-2 text-right text-paper hidden sm:table-cell">{r.dividendPerShare.toFixed(4)}</td>
                          <td className="py-2 pl-2 pr-4 text-right text-ash whitespace-nowrap">
                            {r.status === "DISTRIBUTED"
                              ? `Paid ${fmtUtcDate(r.distributedAt || r.scheduledFor)}`
                              : r.status === "CANCELLED"
                              ? "Cancelled"
                              : `Due ${fmtUtcDate(r.scheduledFor)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {active === "governance" && (
              <CompanyGovernance ticker={c.ticker} isFounderOrAdmin={canFound} />
            )}

            {active === "ledger" && (
              <CompanyLedger ticker={c.ticker} isFounderOrAdmin={canFound} />
            )}

            {active === "about" && (
              <div className="px-4 py-4 flex flex-col gap-4 max-w-2xl">
                <p className="text-[13px] text-paper leading-relaxed">{c.description}</p>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                  <Stat
                    label={c.ticker === "BOMF" ? "Fund manager" : c.coFounderName ? "Founders" : "Founder"}
                    value={c.coFounderName ? `${c.creatorName} & ${c.coFounderName}` : (c.creatorName || "Unknown")}
                  />
                  <Stat label={c.ticker === "BOMF" ? "Total units" : "Total shares"} value={fmtQty(c.totalShares)} />
                  <Stat label={c.ticker === "BOMF" ? "Pre-release float" : "Public float"} value={fmtQty(c.floatShares)} />
                  <Stat label={c.ticker === "BOMF" ? "Launch price" : "IPO price"} value={`${fmtPrice(c.ipoPrice)} gold`} />
                  {c.weeklyRevenue && c.weeklyRevenue > 0 ? (
                    <Stat label="Est. weekly revenue" value={`${c.weeklyRevenue.toLocaleString()} gold`} />
                  ) : null}
                  <Stat label={c.ticker === "BOMF" ? "Fund seed reserve" : "Company treasury"} value={`${fmtGold(c.treasuryBalance || 0)} gold`} />
                  <Stat label="Listed" value={fmtUtcDate(c.createdAt)} />
                  <Stat label={c.ticker === "BOMF" ? "Units redeemed" : "Bought back"} value={fmtQty(c.sharesBoughtBack)} />
                </dl>
              </div>
            )}

            {active === "founder" && canFound && (
              <div className="px-4 py-4 flex flex-col gap-6 max-w-2xl">
                <p className="text-[13px] text-ash leading-relaxed">
                  Only {isFounder ? "you" : "the founder"} and the operator see this tab.
                </p>
                {isFounder ? (
                  <TreasuryPanel company={c} userCash={data.user?.cashBalance || 0} dividendDue={dividendDue} onDone={refresh} />
                ) : (
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                    <Stat label="Company treasury" value={`${fmtGold(c.treasuryBalance || 0)} gold`} />
                  </dl>
                )}
                <section aria-labelledby="payouts-title" className="flex flex-col gap-3">
                  <h3 id="payouts-title" className="text-[13px] font-semibold text-zinc-50">Dividends and buybacks</h3>
                  <p className="text-[12px] text-ash leading-relaxed">
                    Dividends are paid from the treasury first, then your purse. Buybacks are paid from your purse.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setDialog("earnings")} className="h-9 px-4 rounded-[4px] border border-rule hover:border-zinc-500 text-[13px] text-paper">
                      Report weekly earnings
                    </button>
                    <button type="button" onClick={() => setDialog("buyback")} className="h-9 px-4 rounded-[4px] border border-rule hover:border-zinc-500 text-[13px] text-paper">
                      Buy back shares
                    </button>
                  </div>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                    <Stat label="Dividends paid" value={`${fmtGold(c.totalDividendsPaid || 0)} gold`} />
                    <Stat label="Shares bought back" value={fmtQty(c.sharesBoughtBack)} />
                    <Stat label="Spent on buybacks" value={`${fmtGold(c.buybackGoldSpent)} gold`} />
                  </dl>
                </section>
                <CompanyProfileForm key={c.id} company={c} discordHandle={data.founderView?.discordHandle || ""} onDone={refresh} />
              </div>
            )}
          </div>
        </section>

        <section aria-label="Trades" className="lg:[grid-area:trades] hidden lg:flex flex-col border-b border-rule">
          <RecentTrades trades={trades} />
        </section>
      </div>

      {dialog === "buyback" && (
        <BuybackDialog company={c} userCash={data.user?.cashBalance || 0} onClose={() => setDialog(null)} onDone={refresh} />
      )}
      {dialog === "earnings" && (
        <EarningsDialog
          company={c}
          userCash={data.user?.cashBalance || 0}
          nextFriday={data.nextFriday}
          founderShares={founderShares}
          onClose={() => setDialog(null)}
          onDone={refresh}
        />
      )}
    </main>
  );
}

function TradeContent({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  return <Terminal key={ticker.toUpperCase()} ticker={ticker.toUpperCase()} />;
}

export default function TradePage(props: { params: Promise<{ ticker: string }> }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <Suspense fallback={<main className="flex-1" />}>
        <TradeContent params={props.params} />
      </Suspense>
    </div>
  );
}
