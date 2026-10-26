import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Terms — Grow Ur Gold",
  description: "Rules, the in-game gold disclaimer and the conduct policy for Grow Ur Gold.",
};

const h2 = "condensed text-[20px] font-bold text-zinc-50 tracking-tight scroll-mt-20";
const list = "flex flex-col gap-2 pl-5 list-disc marker:text-ash";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="w-full max-w-[680px] mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-8 text-[15px] leading-relaxed text-paper">
        <Link href="/" className="self-start text-[13px] text-ash hover:text-paper flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Markets
        </Link>

        <header className="flex flex-col gap-2">
          <h1 className="condensed text-[34px] leading-none font-extrabold text-zinc-50 tracking-tight">Terms</h1>
          <p className="text-[13px] text-ash">In force from October 2026, for everyone who trades, lists or holds shares on Grow Ur Gold.</p>
        </header>

        <p className="border-l-2 border-bullion pl-4 text-zinc-50">
          Played with Parlamentum gold only: no real money goes in or comes out, and Grow Ur Gold is not run by the Parlamentum team. It is a
          player-run exchange built for the game&apos;s economy.
        </p>

        <section id="gold-rules" className="flex flex-col gap-3">
          <h2 className={h2}>1. Gold only, never real money</h2>
          <p>Purses, shares, IPO subscriptions, dividends and gift codes are all in Parlamentum gold.</p>
          <ul className={list}>
            <li>Grow Ur Gold never accepts real-world money, nor crypto with real-world value.</li>
            <li>Gold in your purse can&apos;t be exchanged for real money, goods or services.</li>
            <li>Deposits and withdrawals happen inside the game, as Raw Iron trades between you and the House.</li>
            <li>The game taxes market trades, at a rate set by each country. A deposit is credited with the gold the House actually receives after that tax.</li>
          </ul>
        </section>

        <section id="operator" className="flex flex-col gap-3">
          <h2 className={h2}>2. An independent project</h2>
          <p>Grow Ur Gold is made by and for Parlamentum players.</p>
          <ul className={list}>
            <li>It isn&apos;t sponsored, endorsed or run by the game&apos;s developers or staff.</li>
            <li>The game&apos;s moderators aren&apos;t responsible for trades or prices here.</li>
            <li>Questions about the exchange go to its operators (such as JosephArora) on the community Discord.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={h2}>3. Trading and company conduct</h2>
          <ul className={list}>
            <li>Founders report their in-game production, workers and revenue truthfully.</li>
            <li>Companies that promise Friday dividends pay them to everyone holding shares at the time.</li>
            <li>Price manipulation, wash trading or listings in bad faith can lead to a trading halt, dilution or a frozen account.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={h2}>4. Your account</h2>
          <p>
            Your username must be your exact Parlamentum character name, so deposits and withdrawals reach the right player. Never use your
            Parlamentum password here: pick a separate one.
          </p>
        </section>

        <section id="withdrawal-policy" className="flex flex-col gap-3">
          <h2 className={h2}>5. Official Withdrawal Policy & Processing Window</h2>
          <p>
            To maintain orderly in-game liquidity and prevent fraudulent abuse, cash-out withdrawals back into Parlamentum follow a strict schedule:
          </p>
          <ul className={list}>
            <li><strong>Friday Windows Only:</strong> Withdrawal requests can only be submitted on <strong>Fridays (00:00 – 23:59 UTC)</strong>.</li>
            <li><strong>Minimum Amount:</strong> The minimum withdrawal is strictly <strong>100 gold</strong>. No requests under 100 gold are accepted.</li>
            <li><strong>48-Hour Processing Window:</strong> All Friday withdrawal requests are reviewed and fulfilled in-game by the House Operator within <strong>48 hours</strong> of submission.</li>
            <li><strong>Support & Tickets:</strong> If your in-game withdrawal has not been fulfilled within 48 hours or you need assistance with your contract, join our official Discord server (<a href="https://discord.gg/q3QA6WzHQZ" target="_blank" rel="noopener noreferrer" className="text-bullion underline">discord.gg/q3QA6WzHQZ</a>) and raise a support ticket.</li>
          </ul>
        </section>

        <p className="border-t border-rule pt-6 text-[13px] text-ash">
          Creating an account or trading on Grow Ur Gold means you accept these terms.
        </p>
      </main>
    </div>
  );
}
