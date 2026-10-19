"use client";

import { use, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import CompanyLedger from "@/components/CompanyLedger";
import { ArrowLeft, ExternalLink } from "lucide-react";

function CompanyLedgerContent({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const cleanTicker = ticker.toUpperCase();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});

    fetch(`/api/market/${cleanTicker}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.company) {
          setCompany(data.company);
        }
      })
      .catch(() => {});
  }, [cleanTicker]);

  const isFounderOrAdmin =
    !!currentUser &&
    (!!currentUser.isAdmin || (company && currentUser.id === company.creatorId));

  return (
    <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/trade/${cleanTicker}`}
            className="h-8 px-2.5 rounded-[4px] border border-rule hover:border-zinc-500 text-[12px] text-paper flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-ash" />
            Back to ${cleanTicker} Market
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl">{company?.logoUrl || "🏛️"}</span>
            <h1 className="condensed text-[24px] font-extrabold text-zinc-50 tracking-tight leading-none">
              ${cleanTicker} Enterprise Ledger
            </h1>
          </div>
        </div>

        <Link
          href={`/trade/${cleanTicker}`}
          className="text-[12px] text-ash hover:text-paper flex items-center gap-1"
        >
          Open Trading Terminal <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="bg-pane/30 border border-rule rounded-[6px]">
        <CompanyLedger ticker={cleanTicker} isFounderOrAdmin={isFounderOrAdmin} />
      </div>
    </main>
  );
}

export default function CompanyLedgerPage(props: { params: Promise<{ ticker: string }> }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <Suspense fallback={<main className="flex-1 w-full max-w-[1200px] mx-auto p-6 text-ash text-sm">Loading ledger…</main>}>
        <CompanyLedgerContent params={props.params} />
      </Suspense>
    </div>
  );
}
