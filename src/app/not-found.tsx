import Link from "next/link";
import { ChartCandlestick, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-4 font-sans">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center">
        {/* Logo */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <ChartCandlestick className="w-7 h-7 text-amber-400" />
        </div>

        {/* Error code */}
        <div className="flex flex-col gap-1">
          <p className="text-7xl font-black text-amber-400 tabular-nums tracking-tight">404</p>
          <h1 className="text-lg font-semibold text-zinc-100">Page not found</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            This ticker doesn&apos;t exist on the exchange floor. It may have been delisted or the URL is incorrect.
          </p>
        </div>

        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[13px] font-bold transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Markets
        </Link>
      </div>
    </div>
  );
}
