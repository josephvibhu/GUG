import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ShieldAlert, Scale, CheckCircle2, AlertTriangle, ArrowLeft, Coins, Landmark, Building2, BookOpen } from "lucide-react";

export const metadata = {
  title: "Terms & Conditions — Grow Ur Gold",
  description: "Official rules, in-game currency disclaimer, and community conduct policy for Grow Ur Gold.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500 selection:text-black">
      <Navbar />

      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-ash hover:text-white transition px-2.5 py-1 rounded bg-pane border border-rule"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Markets
          </Link>
        </div>

        {/* Header */}
        <div className="border-b border-rule pb-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-bullion font-semibold text-xs tracking-wider uppercase">
            <Scale className="w-4 h-4" /> Community Accord & Exchange Rules
          </div>
          <h1 className="condensed text-3xl sm:text-4xl font-extrabold text-zinc-50 tracking-tight">
            Terms & Conditions
          </h1>
          <p className="text-sm text-ash">
            Effective Date: October 2026 • Governs all citizens, companies, and traders on Grow Ur Gold.
          </p>
        </div>

        {/* PRIMARY DISCLAIMER CALLOUT BOX */}
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-bold text-amber-300 uppercase tracking-wide">
              Official Disclaimer
            </h2>
            <p className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
              Played with Parlamentum gold only. No real money goes in or comes out. Not run by the Parlamentum team.
            </p>
            <p className="text-xs text-amber-200/80 mt-1">
              Grow Ur Gold is a 100% community-driven, player-operated simulation and stock exchange layer built strictly for the in-game economy of Parlamentum.
            </p>
          </div>
        </div>

        {/* Sections */}
        <div className="flex flex-col gap-8 text-sm leading-relaxed text-paper">
          {/* Section 1 */}
          <section id="gold-rules" className="flex flex-col gap-3 p-5 rounded-xl bg-pane/40 border border-rule">
            <div className="flex items-center gap-2 text-zinc-100 font-bold text-base">
              <Coins className="w-4 h-4 text-bullion" />
              1. In-Game Gold Only & No Real Money Policy
            </div>
            <p className="text-ash text-xs sm:text-sm">
              All transactions, shares, IPO subscriptions, dividend distributions, gift vouchers, and cash balances on Grow Ur Gold are denominated solely in <strong className="text-zinc-200">Parlamentum virtual gold</strong>.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-ash">
              <li><strong className="text-zinc-300">Zero Fiat Currency:</strong> Under no circumstance does Grow Ur Gold accept real-world currency (USD, EUR, crypto with real-world fiat value, etc.).</li>
              <li><strong className="text-zinc-300">No Cash-Outs to Real Money:</strong> In-game gold held in your Grow Ur Gold purse cannot be converted or redeemed for any real-world money, goods, or services.</li>
              <li><strong className="text-zinc-300">In-Game Settlement:</strong> Gold deposits and withdrawals are executed exclusively inside the Parlamentum game client via verified player-to-player trade items (Raw Iron).</li>
              <li><strong className="text-zinc-300">Parlamentum In-Game Sales Tax:</strong> In-game market trades in Parlamentum carry an automated 5% game sales tax. Wallet deposits reflect 100% of the net virtual gold received by the House.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section id="operator" className="flex flex-col gap-3 p-5 rounded-xl bg-pane/40 border border-rule">
            <div className="flex items-center gap-2 text-zinc-100 font-bold text-base">
              <Building2 className="w-4 h-4 text-emerald-400" />
              2. Independent Project — Not Affiliated with Game Developers
            </div>
            <p className="text-ash text-xs sm:text-sm">
              Grow Ur Gold is an autonomous, open-source community innovation created by and for players of Parlamentum.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-ash">
              <li>It is not sponsored, endorsed, administered by, or associated with the developers, creators, or official management of Parlamentum.</li>
              <li>Official game moderators and administrators are not responsible for transactions or market fluctuations that occur on this platform.</li>
              <li>For inquiries regarding the exchange, please contact the exchange operators (such as JosephArora) on the community Discord.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="flex flex-col gap-3 p-5 rounded-xl bg-pane/40 border border-rule">
            <div className="flex items-center gap-2 text-zinc-100 font-bold text-base">
              <Landmark className="w-4 h-4 text-cyan-400" />
              3. Trading Floor Conduct & Company Governance
            </div>
            <p className="text-ash text-xs sm:text-sm">
              To preserve a vibrant and trustworthy market environment, all participants must observe basic standards of honest commerce:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-ash">
              <li><strong className="text-zinc-300">Accurate Financial Ledgers:</strong> Listed company founders must provide truthful representations of their in-game production, worker headcounts, and revenue.</li>
              <li><strong className="text-zinc-300">Dividend Obligations:</strong> Companies pledging Friday dividends must honor payouts to all registered shareholders based on recorded shareholdings.</li>
              <li><strong className="text-zinc-300">Anti-Manipulation:</strong> Artificial price manipulation, malicious wash-trading schemes, or bad-faith listings may result in immediate trading halts, share dilution, or account freezing.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="flex flex-col gap-3 p-5 rounded-xl bg-pane/40 border border-rule">
            <div className="flex items-center gap-2 text-zinc-100 font-bold text-base">
              <BookOpen className="w-4 h-4 text-purple-400" />
              4. Account Security & Verification
            </div>
            <p className="text-ash text-xs sm:text-sm">
              Your Grow Ur Gold account username must correspond to your exact in-game Parlamentum character name so the exchange operator and automated verifiers can accurately settle gold transfers.
            </p>
            <div className="p-3 bg-zinc-900 border border-rule rounded-lg text-xs text-amber-300/90 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-bullion shrink-0 mt-0.5" />
              <span>
                <strong>Security Reminder:</strong> Never use your Parlamentum game password on Grow Ur Gold. Choose a unique, secure password for this exchange.
              </span>
            </div>
          </section>
        </div>

        {/* Footer acknowledgment CTA */}
        <div className="border-t border-rule pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-ash">
            By creating an account or transacting on Grow Ur Gold, you confirm your acceptance of these Terms.
          </div>
          <Link
            href="/"
            className="h-9 px-5 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor text-xs font-bold flex items-center transition"
          >
            Agree & Continue to Exchange
          </Link>
        </div>
      </main>
    </div>
  );
}
