"use client";

import { use, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import CompanyLedger from "@/components/CompanyLedger";

interface LedgerHeader {
  company: { name: string; logoUrl: string; creatorId: string; coFounderId?: string };
  user: { id: string; isAdmin?: boolean } | null;
}

function CompanyLedgerContent({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const t = ticker.toUpperCase();
  const [data, setData] = useState<LedgerHeader | null>(null);

  useEffect(() => {
    fetch(`/api/market/${t}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => json.success && setData({ company: json.company, user: json.user }))
      .catch(() => {});
  }, [t]);

  const isFounderOrAdmin = !!data?.user && (!!data.user.isAdmin || data.user.id === data.company.creatorId || data.user.id === data.company.coFounderId);

  return (
    <main className="w-full max-w-[900px] mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
      <Link href={`/trade/${t}`} className="self-start text-[13px] text-ash hover:text-paper flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" />
        {t} terminal
      </Link>
      <header className="flex items-center gap-3">
        <span className="h-10 w-10 shrink-0 rounded-[4px] bg-pane border border-rule flex items-center justify-center text-xl" aria-hidden>
          {data?.company.logoUrl || ""}
        </span>
        <div className="min-w-0">
          <h1 className="condensed text-[26px] font-extrabold text-zinc-50 tracking-tight leading-none">{t} ledger</h1>
          <p className="text-[13px] text-ash truncate mt-1">{data?.company.name || " "}</p>
        </div>
      </header>
      <div className="border border-rule rounded-[4px]">
        <CompanyLedger ticker={t} isFounderOrAdmin={isFounderOrAdmin} />
      </div>
    </main>
  );
}

export default function CompanyLedgerPage(props: { params: Promise<{ ticker: string }> }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <Suspense fallback={<main className="flex-1" />}>
        <CompanyLedgerContent params={props.params} />
      </Suspense>
    </div>
  );
}
