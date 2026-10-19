"use client";

import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin dashboard runtime error caught by boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-500/10">
          <AlertCircle className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-black text-white tracking-tight">
          Operator Panel Error
        </h2>
        <p className="text-xs text-zinc-400 mt-2 mb-4 leading-relaxed">
          An unexpected runtime error occurred while loading or synchronizing the operator panel data.
        </p>

        {error?.message && (
          <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 mb-6 text-left">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">
              Error Details:
            </span>
            <code className="text-[11px] text-rose-300 font-mono break-all whitespace-pre-wrap block">
              {error.message}
            </code>
            {error.digest && (
              <span className="text-[9px] text-zinc-500 font-mono mt-1 block">
                Digest: {error.digest}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-black font-bold rounded-xl text-xs hover:bg-amber-400 transition shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Dashboard
          </button>

          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-700 text-zinc-300 font-semibold rounded-xl text-xs hover:bg-zinc-800 transition"
          >
            <Home className="w-3.5 h-3.5" />
            Exchange Floor
          </Link>
        </div>
      </div>
    </div>
  );
}
