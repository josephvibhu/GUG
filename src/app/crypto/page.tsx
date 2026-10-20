import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "BREADCOIN (coming soon) — Grow Ur Gold",
  description: "Preview of BREADCOIN, the grain-backed token planned for Grow Ur Gold.",
};

const MECHANICS = [
  ["Swap any time", "Trade gold for BREADCOIN day and night through an automated pool, without waiting for the trading floor to open."],
  ["Bakery staking", "Stake BREADCOIN in participating bakeries for weekly rewards in gold and grain coupons."],
  ["Grain backing", "Each BREADCOIN stands for grain produced and recorded in the ledgers of registered food companies."],
];

export default function CryptoPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="w-full max-w-[1000px] mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-8">
        <Link href="/" className="self-start text-[13px] text-ash hover:text-paper flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Markets
        </Link>

        <header className="flex flex-col gap-2 max-w-[60ch]">
          <p className="text-[13px] text-bullion">Coming soon, test run planned for Q4 2026</p>
          <h1 className="condensed text-[34px] leading-none font-extrabold text-zinc-50 tracking-tight">BREADCOIN</h1>
          <p className="text-[15px] text-paper leading-relaxed">
            A token backed by the realms&apos; grain, flour and bakeries, traded against gold around the clock and staked for weekly rewards.
          </p>
        </header>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-rule border border-rule rounded-[4px] overflow-hidden">
          {[
            ["Backing", "Certified bakery flour and grain vaults"],
            ["Supply cap", "1,000,000 BREAD"],
            ["Reward", "Daily loaf yield from staking"],
          ].map(([label, value]) => (
            <div key={label} className="bg-floor px-4 py-3">
              <dt className="text-[12px] text-ash">{label}</dt>
              <dd className="text-[14px] text-zinc-50">{value}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="how" className="flex flex-col gap-4">
          <h2 id="how" className="text-[15px] font-semibold text-zinc-50">How it will work</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {MECHANICS.map(([title, text]) => (
              <div key={title} className="flex flex-col gap-1">
                <h3 className="text-[14px] font-semibold text-paper">{title}</h3>
                <p className="text-[13px] text-ash leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="text-[13px] text-ash border-t border-rule pt-5">
          Want to help test it? Ask on the community Discord. Until then,{" "}
          <Link href="/" className="text-paper underline underline-offset-4">
            the listed companies
          </Link>{" "}
          are trading.
        </p>
      </main>
    </div>
  );
}
