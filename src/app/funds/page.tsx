import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Funds (coming soon) — Grow Ur Gold",
  description: "Preview of the three GUG funds: GUG-Gurantee, GUG-Luck and GUG-WarBased.",
};

const UPCOMING_FUNDS = [
  {
    ticker: "GUG-Gurantee",
    name: "GUG-Gurantee Fund",
    category: "Capital protection",
    holdings: ["Operator vault reserve, 60%", "Tier-1 tool foundries, 40%"],
    targetYield: "7.5% weekly guaranteed",
    minimumEntry: "25 gold",
    description:
      "Underwritten by the operator's treasury, with weekly payouts whatever the realm markets or wars do. For cautious citizens who want their gold safe.",
  },
  {
    ticker: "GUG-Luck",
    name: "GUG-Luck High-Roller Trust",
    category: "Speculative",
    holdings: ["Deep-mine prospectors, 50%", "Frontier caravans, 30%", "Speculative startups, 20%"],
    targetYield: "0–35% jackpot yield",
    minimumEntry: "50 gold",
    description: "Backs high-variance expeditions and mineral finds. When one strikes, holders share the Friday jackpot.",
  },
  {
    ticker: "GUG-WarBased",
    name: "GUG-WarBased Logistics Fund",
    category: "Military industry",
    holdings: ["Weaponsmith forges, 45%", "Iron armor foundries, 35%", "Warship shipyards, 20%"],
    targetYield: "15–25% conflict yield",
    minimumEntry: "100 gold",
    description: "Holds arms makers, armor smelters and war fleets. As nations go to war, munitions demand and the fund's dividends rise.",
  },
];

export default function FundsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="w-full max-w-[1000px] mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-8">
        <Link href="/" className="self-start text-[13px] text-ash hover:text-paper flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Markets
        </Link>

        <header className="flex flex-col gap-2 max-w-[60ch]">
          <p className="text-[13px] text-bullion">Coming soon, planned for Q4 2026</p>
          <h1 className="condensed text-[34px] leading-none font-extrabold text-zinc-50 tracking-tight">GUG funds</h1>
          <p className="text-[15px] text-paper leading-relaxed">
            Three funds, each holding a basket of in-game businesses, so you can own a share of a whole sector instead of one company.
          </p>
        </header>

        <section aria-label="Planned funds" className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {UPCOMING_FUNDS.map((f) => (
            <article key={f.ticker} className="border border-rule rounded-[4px] flex flex-col">
              <header className="px-4 pt-4 pb-3 flex flex-col gap-1">
                <span className="text-[12px] text-ash">{f.category}</span>
                <h2 className="condensed text-[22px] font-extrabold text-zinc-50 leading-none">{f.ticker}</h2>
                <span className="text-[13px] text-paper">{f.name}</span>
              </header>
              <dl className="px-4 py-3 border-t border-rule grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
                <dt className="text-ash">Target return</dt>
                <dd className="text-right text-zinc-50">{f.targetYield}</dd>
                <dt className="text-ash">Minimum</dt>
                <dd className="text-right text-paper">{f.minimumEntry}</dd>
              </dl>
              <p className="px-4 py-3 border-t border-rule text-[13px] text-paper leading-relaxed">{f.description}</p>
              <ul className="mt-auto px-4 py-3 border-t border-rule text-[12px] text-ash flex flex-col gap-0.5">
                {f.holdings.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <p className="text-[13px] text-ash">
          Keep gold in your purse to buy in on launch day. Until then,{" "}
          <Link href="/" className="text-paper underline underline-offset-4">
            the listed companies
          </Link>{" "}
          are trading.
        </p>
      </main>
    </div>
  );
}
