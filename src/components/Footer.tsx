import Link from "next/link";
import { CoinMark } from "./CoinMark";
import { ShieldAlert, ExternalLink, Scale, Sparkles, Building2, Coins, Landmark } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-rule bg-floor/80 backdrop-blur-sm text-xs font-sans text-ash">
      {/* Prominent Legal & In-Game Currency Disclaimer Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 py-3.5 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2.5 text-amber-300 font-medium">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[12px] sm:text-[13px] tracking-tight">
              Played with <strong className="text-amber-200 font-semibold">Parlamentum gold only</strong>. No real money goes in or comes out. Not run by the Parlamentum team.
            </span>
          </div>
          <Link
            href="/terms"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2 shrink-0 transition"
          >
            <Scale className="w-3.5 h-3.5" /> Read Terms & Conditions
          </Link>
        </div>
      </div>

      {/* Main Footer Navigation & Details */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <CoinMark className="h-5 w-5" />
            <span className="condensed text-base font-extrabold text-zinc-50 tracking-tight">
              Grow Ur Gold
            </span>
          </div>
          <p className="text-[12px] text-ash leading-relaxed">
            The player-run stock exchange of Parlamentum. Trade company shares for in-game gold, list your enterprise, and collect weekly Friday dividends.
          </p>
          <div className="text-[11px] text-zinc-500 pt-1">
            Community-driven financial infrastructure.
          </div>
        </div>

        {/* Column 1: Exchange */}
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
            Exchange
          </h4>
          <ul className="flex flex-col gap-1.5 text-[12px]">
            <li>
              <Link href="/" className="hover:text-zinc-200 transition">
                Listed Markets
              </Link>
            </li>
            <li>
              <Link href="/trade" className="hover:text-zinc-200 transition">
                Live Trading Floor
              </Link>
            </li>
            <li>
              <Link href="/portfolio" className="hover:text-zinc-200 transition">
                Citizen Portfolio
              </Link>
            </li>
            <li>
              <Link href="/ipo" className="hover:text-zinc-200 transition flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-bullion" /> Apply for IPO
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 2: New Products (Coming Soon) */}
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
            Next Generation
          </h4>
          <ul className="flex flex-col gap-1.5 text-[12px]">
            <li>
              <Link href="/crypto" className="hover:text-zinc-200 transition flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-purple-400" />
                <span>Crypto & Tokens</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  SOON
                </span>
              </Link>
            </li>
            <li>
              <Link href="/funds" className="hover:text-zinc-200 transition flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-cyan-400" />
                <span>Mutual Funds</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  SOON
                </span>
              </Link>
            </li>
            <li className="text-[11px] text-zinc-500 pt-1">
              Season 2 expansion featuring tokenized commodities and syndicate mutual baskets.
            </li>
          </ul>
        </div>

        {/* Column 3: Rules & Transparency */}
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
            Rules & Conduct
          </h4>
          <ul className="flex flex-col gap-1.5 text-[12px]">
            <li>
              <Link href="/terms" className="hover:text-zinc-200 transition">
                Terms & Conditions
              </Link>
            </li>
            <li>
              <Link href="/terms#gold-rules" className="hover:text-zinc-200 transition">
                In-Game Gold Rules
              </Link>
            </li>
            <li>
              <Link href="/terms#operator" className="hover:text-zinc-200 transition">
                Operator Role & Transparency
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-zinc-200 transition">
                Citizen Sign In / Register
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Sub-footer copyright */}
      <div className="border-t border-rule/60 py-4 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-500">
          <div>
            &copy; 2026 Grow Ur Gold (GUG). An independent player project for the Parlamentum community.
          </div>
          <div>
            Powered by player trust, open ledgers, and in-game commerce.
          </div>
        </div>
      </div>
    </footer>
  );
}
